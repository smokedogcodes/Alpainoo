import { Resend } from "resend";
import { getEmailFrom } from "@/lib/email/config";

let client: Resend | null | undefined;

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (client === undefined) {
    client = new Resend(key);
  }
  return client;
}

type SendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  cc?: string[];
};

/** Resend (Cloudflare-recommended for Workers). Free tier ~100 emails/day. */
export async function sendViaResend(input: SendInput) {
  const resend = getResend();
  if (!resend) return null;

  const to = input.to.trim().toLowerCase();
  if (!to) return { ok: false as const, error: "No recipient" };

  const cc = (input.cc || []).map((e) => e.trim().toLowerCase()).filter(Boolean);

  try {
    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: [to],
      ...(cc.length ? { cc } : {}),
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return {
        ok: false as const,
        error:
          typeof error === "object" && error && "message" in error
            ? String((error as { message: string }).message)
            : "Resend send failed",
      };
    }

    return { ok: true as const, id: data?.id, provider: "resend" as const };
  } catch (err) {
    console.error("[email] Resend exception:", err);
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Resend send failed",
    };
  }
}

export { getResend };
