import nodemailer from "nodemailer";
import { getEmailFrom, parseEmailFrom, smtpConfigured } from "@/lib/email/config";

export { smtpConfigured };

function resolveFrom() {
  const name = process.env.SMTP_FROM_NAME?.trim();
  const email = process.env.SMTP_FROM_EMAIL?.trim();
  if (name && email) return { name, email };
  if (email) return { name: "Alpainoo", email };
  return parseEmailFrom(getEmailFrom());
}

function resolveSecure(port: number) {
  const raw = process.env.SMTP_SECURE?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return port === 465;
}

/**
 * Send via SMTP (e.g. Gmail app password). Returns null if SMTP is not configured.
 * Never logs SMTP_PASS.
 */
export async function sendViaSmtp(input: {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text: string;
}) {
  if (!smtpConfigured()) return null;

  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT || 587) || 587;
  const user = process.env.SMTP_USER!.trim();
  const pass = process.env.SMTP_PASS?.trim() || "";
  const from = resolveFrom();
  const secure = resolveSecure(port);

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: pass ? { user, pass } : undefined,
    });

    const info = await transporter.sendMail({
      from: `"${from.name}" <${from.email}>`,
      to: input.to,
      cc: input.cc?.length ? input.cc : undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    return { ok: true as const, id: info.messageId, provider: "smtp" as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Strip accidental credential echoes
    const safe = message.replace(pass, "[redacted]").slice(0, 300);
    console.warn("[email] smtp failed:", safe);
    return { ok: false as const, error: safe, provider: "smtp" as const };
  }
}
