export type ChatIntent = "order" | "faq" | "product" | "general" | "off_topic";

const ORDER_RE =
  /\b(order|orders|my order|track|tracking|shipment|shipping status|delivery|delivered|awb|courier|payment status|refund|cancel|invoice|account|profile|address)\b/i;

const FAQ_RE =
  /\b(shipping|delivery time|return|returns|refund policy|exchange|policy|policies|faq|contact|support|hours|cod|cash on delivery|payment methods|razorpay|ingredients policy|cruelty|organic|warranty)\b/i;

const PRODUCT_RE =
  /\b(product|products|serum|cream|perfume|stock|price|cost|buy|shop|category|hair|skin|fragrance|brand|sku|recommend|bestseller|skincare|moisturizer|cleanser|toner|sunscreen)\b/i;

/** Store-related terms that keep a message in scope even if other words appear. */
const IN_SCOPE_RE =
  /\b(elorakart|elora\s*kart|our store|your store|my cart|checkout|wishlist|skincare|skin care|haircare|hair care)\b/i;

/**
 * Obvious off-topic / out-of-scope asks. Cheap pre-Gemini filter — keep conservative
 * so greetings and short store questions still reach KB/Gemini.
 */
const OFF_TOPIC_RE =
  /\b(politic|election|prime\s*minister|president|modi|trump|biden|congress party|bjp|parliament|geopolitics?|homework|assignment|leetcode|write\s+(me\s+)?(a\s+)?(code|function|program|script|essay|poem|story)|python\s+code|javascript\s+(code|function)|typescript\s+code|react\s+tutorial|debug\s+(this|my)|weather\s+(in|today|forecast)|who\s+won|capital\s+of|bitcoin|crypto(currency)?|stock\s+market|dating\s+advice|relationship\s+advice|recipe\s+for|how\s+to\s+cook|cricket\s+score|football\s+match|math(ematical)?\s+(problem|equation)|solve\s+for\s+[xy]|chatgpt|openai|unrelated\s+to\s+(shopping|store))\b/i;

const FOLLOW_UP_RE =
  /\b(it|that|this|those|these|them|one|also|too|same|previous|above|earlier|again|instead|what about|how about|and the|the first|the second|that one|this one)\b/i;

const FOLLOW_UP_START_RE =
  /^(yes|yep|yeah|no|nope|ok|okay|sure|thanks|thank you|and|also|what about|how about|same|more|why|when|where|which|how much|how long)\b/i;

export const OFF_TOPIC_REFUSAL =
  "I'm Elorakart's store assistant — I can only help with our products, orders, shipping, returns, and shopping policies. Please ask something related to Elorakart.";

export function isOutOfScope(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (IN_SCOPE_RE.test(text) || ORDER_RE.test(text) || FAQ_RE.test(text) || PRODUCT_RE.test(text)) {
    return false;
  }
  return OFF_TOPIC_RE.test(text);
}

export function detectIntent(message: string): ChatIntent {
  if (isOutOfScope(message)) return "off_topic";
  if (ORDER_RE.test(message)) return "order";
  if (FAQ_RE.test(message)) return "faq";
  if (PRODUCT_RE.test(message)) return "product";
  return "general";
}

/** Heuristic: short / referential messages that need prior turns. */
export function looksLikeFollowUp(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (FOLLOW_UP_START_RE.test(text)) return true;
  if (FOLLOW_UP_RE.test(text) && words.length <= 16) return true;
  // Ultra-short fragments usually depend on prior context ("and shipping?", "the serum?")
  if (words.length <= 3 && /[?]/.test(text)) return true;
  return false;
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
