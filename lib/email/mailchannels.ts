import { getEmailFrom, parseEmailFrom } from "@/lib/email/config";

type SendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  cc?: string[];
};

/** MailChannels Email API (100 free emails/day). Domain DNS must be on Cloudflare. */
export async function sendViaMailChannels(input: SendInput) {
  const apiKey = process.env.MAILCHANNELS_API_KEY?.trim();
  if (!apiKey) return null;

  const from = parseEmailFrom(getEmailFrom());
  const to = input.to.trim().toLowerCase();
  if (!to) return { ok: false as const, error: "No recipient" };

  const cc = (input.cc || []).map((e) => e.trim().toLowerCase()).filter(Boolean);

  try {
    const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
            ...(cc.length ? { cc: cc.map((email) => ({ email })) } : {}),
          },
        ],
        from: { email: from.email, name: from.name },
        subject: input.subject,
        content: [
          { type: "text/plain", value: input.text },
          { type: "text/html", value: input.html },
        ],
      }),
    });

    const body = await res.text();
    if (!res.ok) {
      console.error("[email] MailChannels error:", res.status, body);
      return {
        ok: false as const,
        error: `MailChannels ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    return { ok: true as const, id: `mc-${Date.now()}`, provider: "mailchannels" as const };
  } catch (err) {
    console.error("[email] MailChannels exception:", err);
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "MailChannels send failed",
    };
  }
}
