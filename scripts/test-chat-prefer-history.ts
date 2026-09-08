/**
 * Simulates chat route when preferHistory=true (session + "why" prefix).
 */
import {
  detectIntent,
  looksLikeFollowUp,
  isProductSpecificStockQuery,
  resolveProductSearchQuery,
} from "@/lib/chat/intent";
import {
  searchProductsForChat,
  listActiveKnowledgeArticles,
  createChatSession,
  createChatMessage,
  listChatMessages,
} from "@/lib/db/chat";
import { askGemini, type ChatHistoryTurn } from "@/lib/chat/gemini";

const MESSAGE =
  "why Mamaearth Rice Water no other brand any key specification or something for me to choose";

async function loadHistory(sessionId: string): Promise<ChatHistoryTurn[]> {
  const recent = await listChatMessages(sessionId, 11);
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

async function main() {
  const session = await createChatSession({ guestKey: "test-guest" });
  await createChatMessage({
    sessionId: session.id,
    role: "user",
    content: "hello",
    intent: "general",
    source: "user",
  });
  await createChatMessage({
    sessionId: session.id,
    role: "assistant",
    content: "Hi there!",
    intent: "general",
    source: "gemini",
  });

  const intent = detectIntent(MESSAGE);
  const history = await loadHistory(session.id);
  const preferHistory = history.length > 0 && looksLikeFollowUp(MESSAGE);
  console.log({ intent, preferHistory, historyLen: history.length });

  const productQuery = resolveProductSearchQuery(MESSAGE, intent);
  console.log("productQuery:", productQuery);

  const products = await searchProductsForChat(productQuery, 12);
  console.log(
    "products:",
    products.length,
    products.slice(0, 3).map((p) => p.title)
  );

  let context = products
    .map(
      (p) =>
        `${p.title} (${p.brand}, ${p.category}): INR ${p.sellingPrice}, stock=${p.stock}, slug=${p.slug}. ${(p.description ?? "").slice(0, 120)}`
    )
    .join("\n");

  const articles = await listActiveKnowledgeArticles();
  if (articles.length) {
    context +=
      "\n\nFAQ snippets:\n" +
      articles
        .slice(0, 6)
        .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
        .join("\n\n");
  }

  console.log("context length:", context.length);
  console.log("calling gemini...");
  const gemini = await askGemini({
    userMessage: MESSAGE,
    intent,
    context,
    history,
  });
  console.log("gemini result:", gemini);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
