import { getAdminCc, getEmailProvider, emailConfigured, smtpConfigured } from "@/lib/email/config";
import { sendViaMailChannels } from "@/lib/email/mailchannels";
import { sendViaResend } from "@/lib/email/resend-client";
import { sendViaSmtp } from "@/lib/email/smtp";

export { getAdminCc, getEmailFrom, emailConfigured } from "@/lib/email/config";
export { getResend } from "@/lib/email/resend-client";

type ProviderAttempt = "smtp" | "mailchannels" | "resend";

async function logEmailFailure(
  action: string,
  message: string,
  meta: Record<string, unknown>
) {
  void import("@/lib/logging/system-log").then(({ logError }) =>
    logError({ category: "email", action, message, meta })
  );
}

function buildAttemptOrder(provider: ReturnType<typeof getEmailProvider>): ProviderAttempt[] {
  if (provider === "smtp") return ["smtp"];
  if (provider === "mailchannels") return ["mailchannels"];
  if (provider === "resend") return ["resend"];

  // auto: SMTP first when configured, then MailChannels / Resend
  const rest: ProviderAttempt[] = process.env.MAILCHANNELS_API_KEY?.trim()
    ? ["mailchannels", "resend"]
    : ["resend", "mailchannels"];
  if (smtpConfigured()) return ["smtp", ...rest];
  return rest;
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const to = input.to.trim().toLowerCase();
  if (!to) {
    console.warn("[email] skipped (no recipient):", input.subject);
    return { skipped: true as const };
  }

  if (!emailConfigured()) {
    console.info(
      "[email] skipped (set SMTP_* or RESEND_API_KEY / MAILCHANNELS_API_KEY):",
      input.subject
    );
    return { skipped: true as const };
  }

  const cc = getAdminCc(to);
  const payload = { ...input, to, cc };
  const attempts = buildAttemptOrder(getEmailProvider());

  let lastError = "No email provider available";

  for (const name of attempts) {
    const result =
      name === "smtp"
        ? await sendViaSmtp(payload)
        : name === "mailchannels"
          ? await sendViaMailChannels(payload)
          : await sendViaResend(payload);

    if (result === null) continue;
    if (result.ok) return result;

    lastError = result.error;
    console.warn(`[email] ${name} failed, trying next provider…`, result.error);
  }

  await logEmailFailure("SEND_FAILED", lastError, { to, subject: input.subject });
  return { ok: false as const, error: lastError };
}
