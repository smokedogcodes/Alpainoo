import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { detectIntent, scoreKnowledgeMatch, KB_MATCH_THRESHOLD } from "@/lib/chat/intent";
import { askGemini } from "@/lib/chat/gemini";
import {
  findCachedAnswer,
  recordCacheHit,
  shouldCacheAnswer,
  storeCachedAnswer,
} from "@/lib/chat/answer-cache";
import { resolveChatSession, nextTicketNumber, CHAT_SESSION_COOKIE } from "@/lib/chat/session";
import { notifyTicketCreated } from "@/lib/email/tickets";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000).optional(),
  sessionId: z.string().optional().nullable(),
  confirmTicket: z.boolean().optional(),
  ticketSubject: z.string().trim().max(200).optional(),
  ticketCategory: z.enum(["GENERAL", "ORDER"]).optional(),
});

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

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = await rateLimit(`chat:${ip}`, { limit: 20, windowMs: 60_000 });
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
    sessionId: parsed.data.sessionId || cookieSessionId,
    userId,
  });

  if (parsed.data.confirmTicket) {
    const recent = await prisma.chatMessage.findMany({
      where: { sessionId: chatSession.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    const transcript = recent
      .reverse()
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const category = parsed.data.ticketCategory || "GENERAL";
    const tatHours = category === "ORDER" ? 48 : 24;
    const dueAt = new Date(Date.now() + tatHours * 60 * 60 * 1000);
    const email = userEmail || "guest@elorakart.local";
    const ticketNumber = await nextTicketNumber();

    const ticket = await prisma.supportTicket.create({
      data: {
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
      },
    });

    const assistantText = `Ticket ${ticket.ticketNumber} created. Our team aims to respond within ${tatHours} hours (by ${dueAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}).`;
    await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: "assistant",
        content: assistantText,
        intent: "general",
        source: "system",
      },
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

  const intent = detectIntent(message);
  await prisma.chatMessage.create({
    data: {
      sessionId: chatSession.id,
      role: "user",
      content: message,
      intent,
      source: "user",
    },
  });

  if (intent === "order") {
    if (!userId && !userEmail) {
      const reply =
        "To view order or account details, please sign in with Google. I can only share your own orders after you log in.";
      await prisma.chatMessage.create({
        data: {
          sessionId: chatSession.id,
          role: "assistant",
          content: reply,
          intent,
          source: "system",
        },
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

    const orders = await prisma.order.findMany({
      where: {
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(userEmail ? [{ email: userEmail }] : []),
        ],
      },
      include: {
        items: { include: { product: { select: { title: true, slug: true } } } },
        shipment: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

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

    const gemini = await askGemini({ userMessage: message, intent, context });
    const suggestTicket = gemini.suggestTicket || !gemini.canAnswer;
    const reply = suggestTicket
      ? `${gemini.answer}\n\nWould you like me to create a support ticket? Our team will follow up (48h TAT for order issues).`
      : gemini.answer;

    await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: "assistant",
        content: reply,
        intent,
        source: "gemini",
      },
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

  const articles = await prisma.knowledgeArticle.findMany({ where: { active: true } });
  let best: { article: (typeof articles)[0]; score: number } | null = null;
  for (const a of articles) {
    const score = scoreKnowledgeMatch(message, a);
    if (!best || score > best.score) best = { article: a, score };
  }

  if (best && best.score >= KB_MATCH_THRESHOLD) {
    const reply = best.article.answer;
    await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: "assistant",
        content: reply,
        intent: "faq",
        source: "kb",
      },
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

  const cached = await findCachedAnswer(message);
  if (cached) {
    await recordCacheHit(cached.id);
    await prisma.chatMessage.create({
      data: {
        sessionId: chatSession.id,
        role: "assistant",
        content: cached.answer,
        intent: cached.intent || intent,
        source: "cache",
      },
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

  let context = "";
  if (intent === "product" || intent === "general" || intent === "faq") {
    const products = await prisma.product.findMany({
      where: { isHidden: false },
      orderBy: { reviewCount: "desc" },
      take: 12,
      select: {
        title: true,
        slug: true,
        brand: true,
        category: true,
        sellingPrice: true,
        stock: true,
        description: true,
      },
    });
    context = products
      .map(
        (p) =>
          `${p.title} (${p.brand}, ${p.category}): INR ${p.sellingPrice}, stock=${p.stock}, slug=${p.slug}. ${p.description.slice(0, 120)}`
      )
      .join("\n");

    if (articles.length) {
      context +=
        "\n\nFAQ snippets:\n" +
        articles
          .slice(0, 6)
          .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
          .join("\n\n");
    }
  }

  const gemini = await askGemini({ userMessage: message, intent, context });
  const suggestTicket = gemini.suggestTicket || !gemini.canAnswer;
  const reply = suggestTicket
    ? `${gemini.answer}\n\nWould you like me to create a support ticket? (24h TAT for general help)`
    : gemini.answer;

  if (
    shouldCacheAnswer({
      answer: gemini.answer,
      canAnswer: gemini.canAnswer,
      suggestTicket: gemini.suggestTicket,
      intent,
    })
  ) {
    void storeCachedAnswer({
      questionText: message,
      answer: gemini.answer,
      source: "gemini",
      intent,
    });
  }

  await prisma.chatMessage.create({
    data: {
      sessionId: chatSession.id,
      role: "assistant",
      content: reply,
      intent,
      source: "gemini",
    },
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
