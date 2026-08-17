import { GoogleGenerativeAI } from "@google/generative-ai";

export type GeminiChatResult = {
  answer: string;
  canAnswer: boolean;
  suggestTicket: boolean;
};

function extractJson(text: string): GeminiChatResult | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return {
      answer: String(parsed.answer || "").trim(),
      canAnswer: Boolean(parsed.canAnswer),
      suggestTicket: Boolean(parsed.suggestTicket),
    };
  } catch {
    return null;
  }
}

/** Current stable Flash endpoints for new API keys (Gemini 3.x). */
function defaultModelCandidates() {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const defaults = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
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
        if (/3\.7|3\.6|3\.5|3\.1|^gemini-3/i.test(n)) s += 5;
        if (/lite/i.test(n)) s += 1;
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

export async function askGemini(input: {
  userMessage: string;
  intent: string;
  context: string;
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

  const prompt = `You are Elorakart's helpful skincare store assistant.
Answer ONLY using the provided CONTEXT. If context is insufficient, set canAnswer=false and suggestTicket=true.
Never invent order numbers, prices, stock, or personal data.
Be concise and friendly.

INTENT: ${input.intent}

CONTEXT:
${input.context || "(none)"}

USER MESSAGE:
${input.userMessage}

Respond with ONLY valid JSON:
{"answer":"string","canAnswer":true|false,"suggestTicket":true|false}`;

  let models = defaultModelCandidates();
  const discovered = await listGenerateContentModels(key);
  if (discovered.length) {
    models = Array.from(new Set([...models, ...discovered]));
  }

  let lastError: unknown;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = extractJson(text);
      if (parsed?.answer) return parsed;
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
