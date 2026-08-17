import { GoogleGenerativeAI } from "@google/generative-ai";

export type GeminiChatResult = {
  answer: string;
  canAnswer: boolean;
  suggestTicket: boolean;
};

export type ChatHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

function extractJson(text: string): GeminiChatResult | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      const answer = String(parsed.answer || "").trim();
      if (answer) {
        return {
          answer,
          canAnswer: Boolean(parsed.canAnswer),
          suggestTicket: Boolean(parsed.suggestTicket),
        };
      }
    } catch {
      // fall through to salvage truncated JSON
    }
  }

  // Gemini 3 thinking can truncate mid-JSON when the shared token budget is tight.
  const salvage = cleaned.match(/"answer"\s*:\s*"((?:\\.|[^"\\])*)/);
  if (salvage?.[1]) {
    const answer = salvage[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .trim();
    if (answer) {
      return { answer, canAnswer: true, suggestTicket: false };
    }
  }
  return null;
}

/** Prefer lite / widely available Flash IDs; GEMINI_MODEL overrides first pick. */
function defaultModelCandidates() {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const defaults = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3-flash-preview",
  ];
  if (preferred) return [preferred, ...defaults.filter((m) => m !== preferred)];
  return defaults;
}

async function listGenerateContentModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=100`
    );
    if (!res.ok) {
      console.warn("[gemini] listModels failed:", res.status);
      return [];
    }
    const data = (await res.json()) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };
    const names = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => (m.name || "").replace(/^models\//, ""))
      .filter(Boolean);

    // Prefer flash text models over image/tts/live
    const ranked = names.sort((a, b) => {
      const score = (n: string) => {
        let s = 0;
        if (/flash/i.test(n) && !/image|tts|live|audio|omni/i.test(n)) s += 10;
        if (/lite/i.test(n)) s += 6;
        if (/3\.7|3\.6|3\.5|3\.1|^gemini-3/i.test(n)) s += 5;
        return -s;
      };
      return score(a) - score(b);
    });
    return ranked.slice(0, 8);
  } catch (err) {
    console.warn("[gemini] listModels error:", err);
    return [];
  }
}

function formatHistory(history: ChatHistoryTurn[] | undefined): string {
  if (!history?.length) return "(none)";
  return history
    .map((turn) => `${turn.role === "user" ? "Customer" : "Assistant"}: ${turn.content}`)
    .join("\n");
}

export async function askGemini(input: {
  userMessage: string;
  intent: string;
  context: string;
  history?: ChatHistoryTurn[];
}): Promise<GeminiChatResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return {
      answer:
        "The AI assistant is not configured yet. Please create a support ticket and our team will help you.",
      canAnswer: false,
      suggestTicket: true,
    };
  }

  const genAI = new GoogleGenerativeAI(key);

  const prompt = `You are Elorakart's store assistant for a skincare / beauty e-commerce shop in India.
Your ONLY job is helping with Elorakart products, stock/prices from CONTEXT, orders (from CONTEXT only), shipping, returns/refunds, payment methods, and store policies.

STRICT SCOPE:
- Answer ONLY Elorakart shopping and support questions.
- If the user asks about politics, coding/homework, unrelated trivia, other brands' general advice unrelated to shopping at Elorakart, or anything outside this store → refuse briefly, set canAnswer=false and suggestTicket=false. Do NOT push a support ticket for off-topic chat.
- Use RECENT CONVERSATION to resolve follow-ups ("that one", "shipping for it", "what about returns?"). Stay coherent with prior turns.
- Answer using CONTEXT + conversation. If store context is insufficient for an on-topic question, set canAnswer=false and suggestTicket=true.
- Never invent order numbers, prices, stock, tracking, or personal data. Never use another customer's data.
- Be concise and friendly.

INTENT: ${input.intent}

RECENT CONVERSATION (oldest first; may be empty):
${formatHistory(input.history)}

CONTEXT:
${input.context || "(none)"}

CURRENT USER MESSAGE:
${input.userMessage}

Respond with ONLY valid JSON:
{"answer":"string","canAnswer":true|false,"suggestTicket":true|false}`;

  let models = defaultModelCandidates();
  const discovered = await listGenerateContentModels(key);
  if (discovered.length) {
    // Prefer discovered flash-lite first, then static defaults.
    models = Array.from(new Set([...discovered, ...models]));
  }

  let lastError: unknown;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        // Gemini 3 shares maxOutputTokens with thinking; keep budget high + minimal thinking.
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          // Not in @google/generative-ai 0.24 types yet; REST accepts it under generationConfig.
          thinkingConfig: { thinkingLevel: "minimal" },
        } as Parameters<GoogleGenerativeAI["getGenerativeModel"]>[0]["generationConfig"],
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = extractJson(text);
      if (parsed?.answer) {
        console.info(`[gemini] model ${modelName} ok`);
        return parsed;
      }
      console.warn(`[gemini] model ${modelName} returned unparseable text`);
      return {
        answer: text.slice(0, 800) || "I could not form a clear answer.",
        canAnswer: false,
        suggestTicket: true,
      };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[gemini] model ${modelName} failed:`, msg.slice(0, 280));
      if (/API_KEY|PERMISSION|403|401|quota|billing/i.test(msg) && !/404|NOT_FOUND/i.test(msg)) {
        break;
      }
    }
  }

  console.error("[gemini] all models failed:", lastError);
  return {
    answer:
      "I am having trouble reaching the AI service right now. Would you like to create a support ticket?",
    canAnswer: false,
    suggestTicket: true,
  };
}
