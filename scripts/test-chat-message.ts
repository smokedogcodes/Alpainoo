/**
 * Local diagnostic for chat route path (no HTTP).
 * Usage: npx tsx scripts/test-chat-message.ts
 */
import {
  detectIntent,
  looksLikeFollowUp,
  isProductSpecificStockQuery,
  isProductComparisonQuery,
  resolveProductSearchQuery,
  scoreKnowledgeMatch,
} from "@/lib/chat/intent";
import { findCachedAnswer } from "@/lib/chat/answer-cache";
import { searchProductsForChat, listActiveKnowledgeArticles } from "@/lib/db/chat";
import { askGemini } from "@/lib/chat/gemini";

const MESSAGE =
  "why Mamaearth Rice Water no other brand any key specificaTION or something for me to choose";

async function main() {
  console.log("=== intent ===");
  const intent = detectIntent(MESSAGE);
  console.log({ intent, followUp: looksLikeFollowUp(MESSAGE), stockQ: isProductSpecificStockQuery(MESSAGE) });

  console.log("\n=== KB ===");
  const articles = await listActiveKnowledgeArticles();
  let best: { score: number; strong: boolean; title: string } | null = null;
  for (const a of articles) {
    const match = scoreKnowledgeMatch(MESSAGE, a);
    if (!best || match.score > best.score) {
      best = { ...match, title: a.title };
    }
  }
  console.log("best KB:", best);

  console.log("\n=== cache ===");
  const cached = await findCachedAnswer(MESSAGE);
  console.log("cached:", cached ? { score: cached.score, answer: cached.answer.slice(0, 120) } : null);

  console.log("\n=== products ===");
  const productQuery = resolveProductSearchQuery(MESSAGE, intent);
  console.log("productQuery:", productQuery);
  const products = await searchProductsForChat(productQuery, 12);
  console.log("products:", products.length, products.slice(0, 3).map((p) => p.title));

  let context = products
    .map(
      (p) =>
        `${p.title} (${p.brand}, ${p.category}): INR ${p.sellingPrice}, stock=${p.stock}, slug=${p.slug}. ${(p.description ?? "").slice(0, 120)}`
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

  console.log("\n=== gemini ===");
  const gemini = await askGemini({
    userMessage: MESSAGE,
    intent,
    context,
    history: [],
  });
  console.log("gemini:", gemini);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
