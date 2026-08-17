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
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
  });

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

  try {
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
    console.error("[gemini]", err);
    return {
      answer:
        "I am having trouble reaching the AI service right now. Would you like to create a support ticket?",
      canAnswer: false,
      suggestTicket: true,
    };
  }
}
