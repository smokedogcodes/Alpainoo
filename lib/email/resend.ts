import { getAdminCc, getEmailProvider } from "@/lib/email/config";
import { sendViaMailChannels } from "@/lib/email/mailchannels";
import { sendViaResend } from "@/lib/email/resend-client";

export { getAdminCc, getEmailFrom, emailConfigured } from "@/lib/email/config";
export { getResend } from "@/lib/email/resend-client";

async function logEmailFailure(
  action: string,
  message: string,
  meta: Record<string, unknown>
) {
  void import("@/lib/logging/system-log").then(({ logError }) =>
    logError({ category: "email", action, message, meta })
  );
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

  const cc = getAdminCc(to);
  const payload = { ...input, to, cc };
  const provider = getEmailProvider();

  const tryResend = provider === "resend" || provider === "auto";
  const tryMailChannels = provider === "mailchannels" || provider === "auto";

  if (!tryResend && !tryMailChannels) {
    console.info("[email] skipped (no provider configured):", input.subject);
    return { skipped: true as const };
  }

  if (!process.env.RESEND_API_KEY?.trim() && !process.env.MAILCHANNELS_API_KEY?.trim()) {
    console.info(
      "[email] skipped (set RESEND_API_KEY or MAILCHANNELS_API_KEY):",
      input.subject
    );
    return { skipped: true as const };
  }

  const attempts: Array<"mailchannels" | "resend"> =
    provider === "mailchannels"
      ? ["mailchannels"]
      : provider === "resend"
        ? ["resend"]
        : process.env.MAILCHANNELS_API_KEY?.trim()
          ? ["mailchannels", "resend"]
          : ["resend", "mailchannels"];

  let lastError = "No email provider available";

  for (const name of attempts) {
    const result =
      name === "mailchannels"
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
