import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  detectIntent,
  scoreKnowledgeMatch,
  looksLikeFollowUp,
  isProductSpecificStockQuery,
  isProductComparisonQuery,
  resolveProductSearchQuery,
  needsProductCatalogContext,
  OFF_TOPIC_REFUSAL,
  type ChatIntent,
} from "@/lib/chat/intent";
import { askGemini, type ChatHistoryTurn } from "@/lib/chat/gemini";
import {
  findCachedAnswer,
  recordCacheHit,
  shouldCacheAnswer,
  storeCachedAnswer,
} from "@/lib/chat/answer-cache";
import { resolveChatSession, nextTicketNumber, CHAT_SESSION_COOKIE } from "@/lib/chat/session";
import { notifyTicketCreated } from "@/lib/email/tickets";
import {
  createChatMessage,
  createSupportTicket,
  listActiveKnowledgeArticles,
  listChatMessages,
  listRecentOrdersForUser,
  searchProductsForChat,
} from "@/lib/db/chat";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000).optional(),
  sessionId: z.string().optional().nullable(),
  confirmTicket: z.boolean().optional(),
  ticketSubject: z.string().trim().max(200).optional(),
  ticketCategory: z.enum(["GENERAL", "ORDER"]).optional(),
});

/** Recent turns passed to Gemini (excluding the current user message). */
const HISTORY_LIMIT = 10;

function jsonWithSession(
  data: Record<string, unknown>,
  sessionId: string,
  setCookie: boolean,
  init?: { status?: number }
) {
  const res = NextResponse.json(data, init);
  if (setCookie) {
    res.cookies.set(CHAT_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  }
  return res;
}

async function loadConversationHistory(sessionId: string): Promise<ChatHistoryTurn[]> {
  const recent = await listChatMessages(sessionId, HISTORY_LIMIT + 1);
  const chronological = [...recent].reverse();
  const prior =
    chronological.length && chronological[chronological.length - 1]?.role === "user"
      ? chronological.slice(0, -1)
      : chronological;

  return prior
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));
}

function ticketSuggestionSuffix(category: "ORDER" | "GENERAL") {
  return category === "ORDER"
    ? "\n\nWould you like me to create a support ticket? Our team will follow up (48h TAT for order issues)."
    : "\n\nWould you like me to create a support ticket? (24h TAT for general help)";
}

const PRODUCT_HELP_FALLBACK =
  "I can help compare Alpainoo products using names or brands from our catalog — for example Mamaearth Rice Water. Tell me your skin type or what you are looking for (hydration, brightening, etc.) and I will suggest options we carry.";

function productComparisonFallback(message: string): string {
  const terms = resolveProductSearchQuery(message, "product");
  if (terms) {
    return `I can walk you through ${terms} and similar options we stock at Alpainoo — key specs, price, and who each product suits. Tell me your skin or hair concern (hydration, brightening, sensitive skin, etc.) and I will narrow it down.`;
  }
  return PRODUCT_HELP_FALLBACK;
}

export async function POST(req: Request) {
  const reqClone = req.clone();
  try {
    return await handleChatPost(req);
  } catch (err) {
    console.error("[chat] POST failed:", err);
    try {
      const parsed = bodySchema.safeParse(await reqClone.json().catch(() => ({})));
      const message = parsed.success ? parsed.data.message?.trim() : "";
      if (message && !parsed.data?.confirmTicket) {
        const intent = detectIntent(message);
        if (intent === "product" || isProductComparisonQuery(message)) {
          return NextResponse.json({
            reply: isProductComparisonQuery(message)
              ? productComparisonFallback(message)
              : PRODUCT_HELP_FALLBACK,
            source: "system",
            intent,
            requireLogin: false,
            suggestTicket: false,
          });
        }
      }
    } catch {
      // ignore secondary fallback errors
    }
    return NextResponse.json(
      { error: "Chat is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}

async function handleChatPost(req: Request) {
  const ip = clientIp(req);
  const limited = await rateLimit(`chat:${ip}`, { limit: 12, windowMs: 60_000 });
  if (!limited.success) {
    return NextResponse.json({ error: "Too many messages. Please wait a moment." }, { status: 429 });
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(new RegExp(`${CHAT_SESSION_COOKIE}=([^;]+)`));
  const cookieSessionId = cookieMatch?.[1] ? decodeURIComponent(cookieMatch[1]) : null;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;
  const userName = session?.user?.name ?? null;

  const { session: chatSession, setCookie } = await resolveChatSession({
    cookieSessionId,
    userId,
  });

  if (parsed.data.confirmTicket) {
    const recent = await listChatMessages(chatSession.id, 12);

    const subject = (parsed.data.ticketSubject || "").toLowerCase();
    const asksAlpainooSupport =
      /\b(alpainoo|order|shipping|refund|return|product|payment|delivery|support|help|ticket)\b/i.test(
        subject
      ) || parsed.data.ticketCategory === "ORDER";
    const recentOnTopic = recent.some(
      (m) => m.role === "user" && m.intent && m.intent !== "off_topic"
    );
    if (!asksAlpainooSupport && !recentOnTopic) {
      const reply =
        "I can only create support tickets for Alpainoo store issues (orders, products, shipping, policies). Please ask about your Alpainoo concern first.";
      await createChatMessage({
        sessionId: chatSession.id,
        role: "assistant",
        content: reply,
        intent: "off_topic",
        source: "system",
      });
      return jsonWithSession(
        {
          sessionId: chatSession.id,
          reply,
          source: "system",
          requireLogin: false,
          suggestTicket: false,
        },
        chatSession.id,
        setCookie
      );
    }

    const transcript = [...recent]
      .reverse()
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const category = parsed.data.ticketCategory || "GENERAL";
    const tatHours = category === "ORDER" ? 48 : 24;
    const dueAt = new Date(Date.now() + tatHours * 60 * 60 * 1000);
    const email = userEmail || "guest@alpainoo.local";
    const ticketNumber = await nextTicketNumber();

    const ticket = await createSupportTicket({
      ticketNumber,
      userId,
      email,
      name: userName,
      subject: parsed.data.ticketSubject || "Chat support request",
      description: transcript || "Customer requested human support from chat.",
      status: "OPEN",
      category,
      tatHours,
      dueAt,
      sessionId: chatSession.id,
    });

    const assistantText = `Ticket ${ticket.ticketNumber} created. Our team aims to respond within ${tatHours} hours (by ${dueAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}).`;
    await createChatMessage({
      sessionId: chatSession.id,
      role: "assistant",
      content: assistantText,
      intent: "general",
      source: "system",
    });

    void notifyTicketCreated({
      ticketNumber: ticket.ticketNumber,
      email,
      name: userName,
      subject: ticket.subject,
      description: ticket.description,
      tatHours,
      dueAt,
    });

    return jsonWithSession(
      {
        sessionId: chatSession.id,
        reply: assistantText,
        source: "system",
        requireLogin: false,
        suggestTicket: false,
        ticket: {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          tatHours,
          dueAt: dueAt.toISOString(),
        },
      },
      chatSession.id,
      setCookie
    );
  }

  const message = parsed.data.message;
  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const intent: ChatIntent = detectIntent(message);
  await createChatMessage({
    sessionId: chatSession.id,
    role: "user",
    content: message,
    intent,
    source: "user",
  });

  if (intent === "off_topic") {
    await createChatMessage({
      sessionId: chatSession.id,
      role: "assistant",
      content: OFF_TOPIC_REFUSAL,
      intent: "off_topic",
      source: "system",
    });
    return jsonWithSession(
      {
        sessionId: chatSession.id,
        reply: OFF_TOPIC_REFUSAL,
        source: "system",
        intent: "off_topic",
        requireLogin: false,
        suggestTicket: false,
        canAnswer: false,
      },
      chatSession.id,
      setCookie
    );
  }

  const history = await loadConversationHistory(chatSession.id);
  const preferHistory = history.length > 0 && looksLikeFollowUp(message);
  const productStockQuery = isProductSpecificStockQuery(message);

  if (intent === "order") {
    if (!userId && !userEmail) {
      const reply =
        "To view order or account details, please sign in with Google. I can only share your own orders after you log in.";
      await createChatMessage({
        sessionId: chatSession.id,
        role: "assistant",
        content: reply,
        intent,
        source: "system",
      });
      return jsonWithSession(
        {
          sessionId: chatSession.id,
          reply,
          source: "system",
          intent,
          requireLogin: true,
          suggestTicket: false,
        },
        chatSession.id,
        setCookie
      );
    }

    const orders = await listRecentOrdersForUser({ userId, email: userEmail }, 8);

    const context =
      orders.length === 0
        ? "This signed-in user has no orders on file."
        : orders
            .map((o) => {
              const items = o.items
                .map((i) => `${i.product.title} x${i.quantity}`)
                .join(", ");
              return `Order ${o.orderNumber}: status=${o.orderStatus}, payment=${o.paymentStatus}, total=INR ${o.totalAmount}, items=[${items}], courier=${o.shipment?.courierName || "n/a"}, tracking=${o.shipment?.trackingStatus || "n/a"}, awb=${o.shipment?.awbCode || "n/a"}, created=${o.createdAt.toISOString()}`;
            })
            .join("\n");

    const gemini = await askGemini({
      userMessage: message,
      intent,
      context,
      history,
    });
    const suggestTicket = Boolean(gemini.suggestTicket);
    const reply = suggestTicket
      ? `${gemini.answer}${ticketSuggestionSuffix("ORDER")}`
      : gemini.answer;

    await createChatMessage({
      sessionId: chatSession.id,
      role: "assistant",
      content: reply,
      intent,
      source: "gemini",
    });

    return jsonWithSession(
      {
        sessionId: chatSession.id,
        reply,
        source: "gemini",
        intent,
        requireLogin: false,
        suggestTicket,
        ticketCategory: "ORDER",
      },
      chatSession.id,
      setCookie
    );
  }

  const articles = await listActiveKnowledgeArticles().catch((err) => {
    console.warn("[chat] knowledge articles load failed:", err);
    return [] as Awaited<ReturnType<typeof listActiveKnowledgeArticles>>;
  });

  if (!preferHistory && !productStockQuery) {
    let best: { article: (typeof articles)[0]; score: number; strong: boolean } | null = null;
    for (const a of articles) {
      const match = scoreKnowledgeMatch(message, a);
      if (!best || match.score > best.score) {
        best = { article: a, score: match.score, strong: match.strong };
      }
    }

    if (best && best.strong) {
      const reply = best.article.answer;
      await createChatMessage({
        sessionId: chatSession.id,
        role: "assistant",
        content: reply,
        intent: "faq",
        source: "kb",
      });
      return jsonWithSession(
        {
          sessionId: chatSession.id,
          reply,
          source: "kb",
          intent: "faq",
          requireLogin: false,
          suggestTicket: false,
          kbTitle: best.article.title,
        },
        chatSession.id,
        setCookie
      );
    }

    let cached: Awaited<ReturnType<typeof findCachedAnswer>> = null;
    try {
      cached = await findCachedAnswer(message);
    } catch (cacheErr) {
      console.warn("[chat] answer cache lookup failed:", cacheErr);
    }
    if (
      cached &&
      !(isProductComparisonQuery(message) && /\bin stock\b/i.test(cached.answer))
    ) {
      await recordCacheHit(cached.id);
      await createChatMessage({
        sessionId: chatSession.id,
        role: "assistant",
        content: cached.answer,
        intent: cached.intent || intent,
        source: "cache",
      });
      return jsonWithSession(
        {
          sessionId: chatSession.id,
          reply: cached.answer,
          source: "cache",
          intent: cached.intent || intent,
          requireLogin: false,
          suggestTicket: false,
        },
        chatSession.id,
        setCookie
      );
    }
  }

  let context = "";
  if (needsProductCatalogContext(message, intent)) {
    const productQuery = resolveProductSearchQuery(message, intent);
    let products: Awaited<ReturnType<typeof searchProductsForChat>> = [];
    try {
      products = await searchProductsForChat(productQuery, 12);
    } catch (searchErr) {
      console.warn("[chat] product search failed:", searchErr);
    }
    context = products
      .map(
        (p) =>
          `${p.title} (${p.brand}, ${p.category}): INR ${p.sellingPrice}, stock=${p.stock}, slug=${p.slug}. ${(p.description ?? "").slice(0, 120)}`
      )
      .join("\n");

    if (articles.length) {
      const faqArticles = productStockQuery
        ? articles.filter((a) => a.slug !== "stock-availability")
        : articles;
      context +=
        "\n\nFAQ snippets:\n" +
        faqArticles
          .slice(0, 6)
          .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
          .join("\n\n");
    }
  }

  let gemini: Awaited<ReturnType<typeof askGemini>>;
  try {
    gemini = await askGemini({
      userMessage: message,
      intent,
      context,
      history,
    });
  } catch (geminiErr) {
    console.warn("[chat] askGemini threw:", geminiErr);
    gemini = {
      answer:
        "I am having trouble reaching the AI service right now. Would you like to create a support ticket?",
      canAnswer: false,
      suggestTicket: true,
    };
  }
  const suggestTicket = Boolean(gemini.suggestTicket);
  let reply = suggestTicket
    ? `${gemini.answer}${ticketSuggestionSuffix("GENERAL")}`
    : gemini.answer;

  const productComparison = isProductComparisonQuery(message);
  if (
    (!gemini.canAnswer || /trouble reaching the AI service/i.test(gemini.answer)) &&
    (intent === "product" || productComparison)
  ) {
    reply = productComparison ? productComparisonFallback(message) : PRODUCT_HELP_FALLBACK;
  } else if (!gemini.canAnswer && !suggestTicket && intent === "product") {
    reply = PRODUCT_HELP_FALLBACK;
  }

  if (
    shouldCacheAnswer({
      answer: gemini.answer,
      canAnswer: gemini.canAnswer,
      suggestTicket: gemini.suggestTicket,
      intent,
    }) &&
    !preferHistory
  ) {
    void storeCachedAnswer({
      questionText: message,
      answer: gemini.answer,
      source: "gemini",
      intent,
    });
  }

  await createChatMessage({
    sessionId: chatSession.id,
    role: "assistant",
    content: reply,
    intent,
    source: "gemini",
  });

  return jsonWithSession(
    {
      sessionId: chatSession.id,
      reply,
      source: "gemini",
      intent,
      requireLogin: false,
      suggestTicket,
      ticketCategory: "GENERAL",
    },
    chatSession.id,
    setCookie
  );
}
