export type ChatIntent = "order" | "faq" | "product" | "general";

const ORDER_RE =
  /\b(order|orders|my order|track|tracking|shipment|shipping status|delivery|delivered|awb|courier|payment status|refund|cancel|invoice|account|profile|address)\b/i;

const FAQ_RE =
  /\b(shipping|delivery time|return|returns|refund policy|exchange|policy|policies|faq|contact|support|hours|cod|cash on delivery|payment methods|razorpay|ingredients policy|cruelty|organic|warranty)\b/i;

const PRODUCT_RE =
  /\b(product|products|serum|cream|perfume|stock|price|cost|buy|shop|category|hair|skin|fragrance|brand|sku|recommend|bestseller)\b/i;

export function detectIntent(message: string): ChatIntent {
  if (ORDER_RE.test(message)) return "order";
  if (FAQ_RE.test(message)) return "faq";
  if (PRODUCT_RE.test(message)) return "product";
  return "general";
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function scoreKnowledgeMatch(
  message: string,
  article: { title: string; question: string; keywords: string; answer: string }
): number {
  const msgTokens = new Set(tokenize(message));
  if (msgTokens.size === 0) return 0;

  let keywords: string[] = [];
  try {
    const parsed = JSON.parse(article.keywords);
    if (Array.isArray(parsed)) keywords = parsed.map(String);
  } catch {
    keywords = article.keywords.split(",").map((k) => k.trim());
  }

  const haystack = tokenize(
    `${article.title} ${article.question} ${keywords.join(" ")} ${article.answer.slice(0, 200)}`
  );
  const hay = new Set(haystack);

  let hits = 0;
  Array.from(msgTokens).forEach((t) => {
    if (hay.has(t)) hits += 1;
  });

  // Boost exact phrase overlaps
  const lower = message.toLowerCase();
  if (article.question && lower.includes(article.question.toLowerCase().slice(0, 40))) {
    hits += 3;
  }
  for (const kw of keywords) {
    if (kw && lower.includes(kw.toLowerCase())) hits += 2;
  }

  return hits / Math.max(msgTokens.size, 1);
}

export const KB_MATCH_THRESHOLD = 0.55;
