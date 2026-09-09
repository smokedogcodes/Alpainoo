/** Shared email configuration and provider selection. */

export type EmailProviderName = "smtp" | "resend" | "mailchannels" | "auto";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim());
}

export function getEmailProvider(): EmailProviderName {
  const raw = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (raw === "smtp" || raw === "resend" || raw === "mailchannels") return raw;
  return "auto";
}

export function getEmailFrom() {
  const name = process.env.SMTP_FROM_NAME?.trim();
  const email = process.env.SMTP_FROM_EMAIL?.trim();
  if (name && email) return `${name} <${email}>`;
  if (email) return `Alpainoo <${email}>`;
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Alpainoo <onboarding@resend.dev>"
  );
}

/** Parse `Name <email@domain.com>` or plain email. */
export function parseEmailFrom(from: string) {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^["']|["']$/g, ""), email: match[2].trim() };
  }
  return { name: "Alpainoo", email: from.trim() };
}

/** Admin CC list: ADMIN_EMAIL + store owners, excluding the customer. */
export function getAdminCc(customerEmail?: string | null) {
  const owners = ["elorakart1@gmail.com", "elolrakart1@gmail.com"];
  const fromEnv = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const customer = (customerEmail || "").toLowerCase().trim();
  const set = new Set<string>([...fromEnv, ...owners]);
  if (customer) set.delete(customer);
  return Array.from(set);
}

export function emailConfigured() {
  return Boolean(
    smtpConfigured() ||
      process.env.RESEND_API_KEY?.trim() ||
      process.env.MAILCHANNELS_API_KEY?.trim()
  );
}
