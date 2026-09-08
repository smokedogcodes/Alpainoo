import {
  listActiveAnswerCache,
  incrementAnswerCacheHit,
  upsertAnswerCache,
} from "@/lib/db/chat";
import { isProductSpecificStockQuery, isProductComparisonQuery } from "@/lib/chat/intent";

/** Token-overlap score required to reuse a cached answer (skip Gemini). */
export const CACHE_MATCH_THRESHOLD = 0.6;

const UNCACHABLE_ANSWER_RE =
  /trouble reaching|please sign in|create a support ticket|not configured yet|could not form a clear answer/i;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** Lowercase, trim, collapse whitespace, light punctuation strip. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreCacheMatch(
  message: string,
  entry: { questionText: string; questionNormalized: string; keywords: string; answer: string }
): number {
  const msgTokens = new Set(tokenize(message));
  if (msgTokens.size === 0) return 0;

  let keywords: string[] = [];
  try {
    const parsed = JSON.parse(entry.keywords);
    if (Array.isArray(parsed)) keywords = parsed.map(String);
  } catch {
    keywords = entry.keywords.split(",").map((k) => k.trim()).filter(Boolean);
  }

  const haystack = tokenize(
    `${entry.questionText} ${entry.questionNormalized} ${keywords.join(" ")} ${entry.answer.slice(0, 200)}`
  );
  const hay = new Set(haystack);

  let hits = 0;
  Array.from(msgTokens).forEach((t) => {
    if (hay.has(t)) hits += 1;
  });

  const lower = message.toLowerCase();
  const qLower = entry.questionText.toLowerCase();
  if (qLower && lower.includes(qLower.slice(0, 40))) {
    hits += 3;
  }
  const norm = normalizeQuestion(message);
  if (norm && entry.questionNormalized && norm === entry.questionNormalized) {
    hits += 5;
  }
  for (const kw of keywords) {
    if (kw && lower.includes(kw.toLowerCase())) hits += 2;
  }

  return hits / Math.max(msgTokens.size, 1);
}

export function shouldCacheAnswer(opts: {
  answer: string;
  canAnswer: boolean;
  suggestTicket: boolean;
  intent: string;
}): boolean {
  if (!opts.canAnswer || opts.suggestTicket) return false;
  if (opts.intent === "order" || opts.intent === "off_topic") return false;
  const answer = opts.answer.trim();
  if (!answer) return false;
  if (UNCACHABLE_ANSWER_RE.test(answer)) return false;
  if (/only help with|store assistant|unrelated|off[- ]topic/i.test(answer)) return false;
  return true;
}

const GENERIC_STOCK_FAQ_ANSWER_RE =
  /product pages and the shop catalog show live stock|\bin stock\b|\bunits available\b/i;

export async function findCachedAnswer(message: string): Promise<{
  id: string;
  answer: string;
  intent: string | null;
  score: number;
} | null> {
  const entries = await listActiveAnswerCache(200);

  let best: { id: string; answer: string; intent: string | null; score: number } | null = null;
  for (const entry of entries) {
    const score = scoreCacheMatch(message, entry);
    if (!best || score > best.score) {
      best = {
        id: entry.id,
        answer: entry.answer,
        intent: entry.intent,
        score,
      };
    }
  }

  if (!best || best.score < CACHE_MATCH_THRESHOLD) return null;
  if (
    isProductSpecificStockQuery(message) &&
    GENERIC_STOCK_FAQ_ANSWER_RE.test(best.answer)
  ) {
    return null;
  }
  if (isProductComparisonQuery(message) && GENERIC_STOCK_FAQ_ANSWER_RE.test(best.answer)) {
    return null;
  }
  return best;
}

export async function recordCacheHit(id: string): Promise<void> {
  await incrementAnswerCacheHit(id);
}

export async function storeCachedAnswer(opts: {
  questionText: string;
  answer: string;
  source: "gemini" | "kb";
  intent?: string | null;
}): Promise<void> {
  const questionNormalized = normalizeQuestion(opts.questionText);
  if (!questionNormalized || !opts.answer.trim()) return;

  const keywords = JSON.stringify(
    Array.from(new Set(tokenize(opts.questionText))).slice(0, 24)
  );

  await upsertAnswerCache({
    questionText: opts.questionText.trim(),
    questionNormalized,
    answer: opts.answer.trim(),
    source: opts.source,
    intent: opts.intent ?? null,
    keywords,
  });
}
