export type ChatIntent = "order" | "faq" | "product" | "general" | "off_topic";

const ORDER_RE =
  /\b(order|orders|my order|track|tracking|shipment|shipping status|delivery|delivered|awb|courier|payment status|refund|cancel|invoice|account|profile|address)\b/i;

const FAQ_RE =
  /\b(shipping|delivery time|return|returns|refund policy|exchange|policy|policies|faq|contact|support|hours|cod|cash on delivery|payment methods|razorpay|ingredients policy|cruelty|organic|warranty)\b/i;

const PRODUCT_RE =
  /\b(product|products|serum|cream|perfume|stock|price|cost|buy|shop|category|hair|skin|fragrance|brand|sku|recommend|bestseller|skincare|moisturizer|cleanser|toner|sunscreen)\b/i;

/** Store-related terms that keep a message in scope even if other words appear. */
const IN_SCOPE_RE =
  /\b(alpainoo|elora\s*kart|our store|your store|my cart|checkout|wishlist|skincare|skin care|haircare|hair care)\b/i;

/**
 * Obvious off-topic / out-of-scope asks. Cheap pre-Gemini filter — keep conservative
 * so greetings and short store questions still reach KB/Gemini.
 */
const OFF_TOPIC_RE =
  /\b(politic|election|prime\s*minister|president|modi|trump|biden|congress party|bjp|parliament|geopolitics?|homework|assignment|leetcode|write\s+(me\s+)?(a\s+)?(code|function|program|script|essay|poem|story)|python\s+code|javascript\s+(code|function)|typescript\s+code|react\s+tutorial|debug\s+(this|my)|weather\s+(in|today|forecast)|who\s+won|capital\s+of|bitcoin|crypto(currency)?|stock\s+market|dating\s+advice|relationship\s+advice|recipe\s+for|how\s+to\s+cook|cricket\s+score|football\s+match|math(ematical)?\s+(problem|equation)|solve\s+for\s+[xy]|chatgpt|openai|unrelated\s+to\s+(shopping|store))\b/i;

const FOLLOW_UP_RE =
  /\b(it|that|this|those|these|them|one|also|too|same|previous|above|earlier|again|instead|what about|how about|and the|the first|the second|that one|this one)\b/i;

const FOLLOW_UP_START_RE =
  /^(yes|yep|yeah|no|nope|ok|okay|sure|thanks|thank you|and|also|what about|how about|same|more|when|where|which|how much|how long)\b/i;

export const OFF_TOPIC_REFUSAL =
  "I'm Alpainoo's store assistant — I can only help with our products, orders, shipping, returns, and shopping policies. Please ask something related to Alpainoo.";

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

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "had",
  "her",
  "was",
  "one",
  "our",
  "out",
  "get",
  "has",
  "him",
  "his",
  "how",
  "its",
  "may",
  "new",
  "now",
  "old",
  "see",
  "two",
  "way",
  "who",
  "did",
  "let",
  "put",
  "say",
  "she",
  "too",
  "use",
  "what",
  "when",
  "where",
  "which",
  "will",
  "with",
  "your",
  "have",
  "this",
  "that",
  "from",
  "they",
  "been",
  "than",
  "into",
  "just",
  "about",
  "does",
  "need",
  "want",
  "know",
  "tell",
  "please",
  "also",
  "any",
  "there",
  "their",
  "would",
  "could",
  "should",
  "some",
  "more",
  "other",
]);

/** Broad store terms that appear across many KB articles — not enough alone for a match. */
const GENERIC_COMMERCE_TERMS = new Set([
  "shipping",
  "delivery",
  "order",
  "orders",
  "return",
  "returns",
  "refund",
  "product",
  "products",
  "payment",
  "support",
  "account",
  "policy",
  "policies",
  "track",
  "tracking",
  "cancel",
  "stock",
  "availability",
  "available",
  "inventory",
  "contact",
  "help",
  "exchange",
  "ship",
  "shipped",
  "courier",
  "pay",
  "login",
  "sign",
  "store",
  "shop",
  "buy",
  "item",
  "items",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function meaningfulTokens(text: string): string[] {
  return tokenize(text).filter((t) => !STOPWORDS.has(t));
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseKeywords(raw: string): string[] {
  let keywords: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) keywords = parsed.map(String);
  } catch {
    keywords = raw.split(",").map((k) => k.trim());
  }
  return keywords.filter(Boolean);
}

/** Overlap of multi-word phrases between the user message and article question/title. */
function phraseOverlapScore(message: string, question: string, title: string): number {
  const msg = normalizeForMatch(message);
  if (!msg) return 0;

  let best = 0;
  for (const pattern of [question, title]) {
    const p = normalizeForMatch(pattern);
    if (!p) continue;
    if (msg === p) return 1;
    if (p.length >= 12 && (msg.includes(p) || p.includes(msg))) {
      best = Math.max(best, 0.88);
      continue;
    }

    const words = p.split(" ").filter(Boolean);
    for (let n = Math.min(5, words.length); n >= 2; n--) {
      for (let i = 0; i <= words.length - n; i++) {
        const gram = words.slice(i, i + n).join(" ");
        if (gram.length >= 8 && msg.includes(gram)) {
          best = Math.max(best, 0.42 + n * 0.1);
        }
      }
    }
  }
  return Math.min(1, best);
}

export type KnowledgeMatchResult = {
  score: number;
  strong: boolean;
};

/** Minimum composite score; must also pass `strong` gates to use KB. */
export const KB_MATCH_THRESHOLD = 0.85;

export function scoreKnowledgeMatch(
  message: string,
  article: { title: string; question: string; keywords: string; answer: string }
): KnowledgeMatchResult {
  const msgTokens = meaningfulTokens(message);
  if (msgTokens.length === 0) return { score: 0, strong: false };

  const patternTokens = meaningfulTokens(`${article.title} ${article.question}`);
  const patternSet = new Set(patternTokens);

  let patternHits = 0;
  let discriminatingHits = 0;
  for (const t of msgTokens) {
    if (patternSet.has(t)) {
      patternHits += 1;
      if (!GENERIC_COMMERCE_TERMS.has(t)) discriminatingHits += 1;
    }
  }

  const patternRatio = patternHits / msgTokens.length;
  const questionCoverage =
    patternHits / Math.max(new Set(patternTokens).size, 1);

  const phraseScore = phraseOverlapScore(message, article.question, article.title);

  const lower = message.toLowerCase();
  const keywords = parseKeywords(article.keywords);
  let keywordPhraseHits = 0;
  for (const kw of keywords) {
    const k = kw.toLowerCase().trim();
    if (!k || k.length < 4) continue;
    if (k.includes(" ") && lower.includes(k)) {
      keywordPhraseHits += 1;
    }
  }

  const keywordBonus =
    keywordPhraseHits > 0 && (patternHits >= 1 || phraseScore >= 0.35)
      ? Math.min(0.15, keywordPhraseHits * 0.08)
      : 0;

  const score = Math.min(
    1,
    patternRatio * 0.45 +
      questionCoverage * 0.25 +
      phraseScore * 0.45 +
      keywordBonus
  );

  const strong =
    score >= KB_MATCH_THRESHOLD &&
    (phraseScore >= 0.5 ||
      (patternHits >= 2 && discriminatingHits >= 1 && patternRatio >= 0.35) ||
      (patternHits >= 3 && patternRatio >= 0.4) ||
      (phraseScore >= 0.35 && discriminatingHits >= 2));

  return { score, strong };
}

/** User asks whether a named product is in stock (not a generic stock-policy FAQ). */
const STOCK_QUERY_TEST_RE =
  /\b(stock|availability|available|in\s+stock|out\s+of\s+stock|inventory)\b/i;

const STOCK_QUERY_STRIP_RE =
  /\b(stock|availability|available|in\s+stock|out\s+of\s+stock|inventory)\b/gi;

const GENERIC_STOCK_QUESTION_RE =
  /\b(how\s+(do|can|to)|what\s+(is|are)|where\s+(can|do)|when\s+(will|can)|do\s+you|tell\s+me\s+about)\b[\s\S]{0,80}\b(stock|availability|available|in\s+stock|inventory)\b/i;

export function isProductSpecificStockQuery(message: string): boolean {
  const text = message.trim();
  if (!text || !STOCK_QUERY_TEST_RE.test(text)) return false;
  if (GENERIC_STOCK_QUESTION_RE.test(text)) return false;

  const tokens = meaningfulTokens(text);
  const productLike = tokens.filter((t) => !GENERIC_COMMERCE_TERMS.has(t));
  return productLike.length >= 1;
}

/** Comparison / spec questions — do not reuse generic stock-only cached answers. */
export function isProductComparisonQuery(message: string): boolean {
  return /\b(other\s+brand|vs\.?|versus|compare|comparison|choose|choosing|pick|picking|better|best|specification|specifications|specs|feature|features|difference|different|recommend|instead\s+of)\b/i.test(
    message
  );
}

const PRODUCT_QUERY_NOISE_RE =
  /\b(why|how|what|which|where|when|choose|choosing|pick|picking|compare|comparison|versus|vs|better|best|recommend|something|anything|please|tell|explain|help|key|specification|specifications|specs|feature|features|detail|details|difference|different|option|options|instead|over|about|would|could|should|other|others|brand|brands|any|some|me|for|or|and|no|not)\b/gi;

/** Strip stock/availability and comparison filler so product search matches catalog titles/brands. */
export function extractProductSearchTerms(message: string): string {
  const stripped = message
    .replace(STOCK_QUERY_STRIP_RE, " ")
    .replace(PRODUCT_QUERY_NOISE_RE, " ")
    .replace(/\b(check|tell|me|please|is|are|the|a|an|any|do|you|have|got)\b/gi, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Drop leftover short tokens (e.g. "to" from "for me to choose").
  const tokens = stripped
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t.toLowerCase()));
  return tokens.join(" ").trim();
}

/** Whether the message needs catalog product context (search or top picks). */
export function needsProductCatalogContext(
  message: string,
  intent: ChatIntent
): boolean {
  return (
    intent === "product" ||
    intent === "general" ||
    intent === "faq" ||
    isProductSpecificStockQuery(message) ||
    isProductComparisonQuery(message)
  );
}

/** Resolve D1/Prisma search string for messy product / comparison questions. */
export function resolveProductSearchQuery(message: string, intent: ChatIntent): string {
  const shouldExtract =
    isProductSpecificStockQuery(message) ||
    intent === "product" ||
    isProductComparisonQuery(message);

  if (!shouldExtract) return message;

  const extracted = extractProductSearchTerms(message);
  if (extracted) return extracted;

  const ranked = rankProductSearchTerms(message, 3);
  if (ranked.length) return ranked.join(" ");

  return message.trim();
}

/** Top product-like tokens for catalog search (keeps D1 LIKE patterns small). */
export function rankProductSearchTerms(message: string, max = 4): string[] {
  const cleaned = extractProductSearchTerms(message);
  const tokens = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !GENERIC_COMMERCE_TERMS.has(t));
  const unique = Array.from(new Set(tokens));
  unique.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return unique.slice(0, max);
}
