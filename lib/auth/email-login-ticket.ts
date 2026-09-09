import { createHmac, timingSafeEqual } from "crypto";

const LOGIN_TICKET_TTL_MS = 5 * 60_000;

function otpPepper() {
  return (
    process.env.OTP_PEPPER?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "dev-otp-pepper"
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Short-lived proof that email OTP succeeded — used by Credentials sign-in. */
export function createEmailLoginTicket(userId: string, email: string) {
  const exp = Date.now() + LOGIN_TICKET_TTL_MS;
  const payload = `${userId}|${normalizeEmail(email)}|${exp}`;
  const sig = createHmac("sha256", otpPepper()).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

export function verifyEmailLoginTicket(
  ticket: string,
  expectedEmail: string
): { userId: string; email: string } | null {
  try {
    const raw = Buffer.from(ticket, "base64url").toString("utf8");
    const parts = raw.split("|");
    if (parts.length !== 4) return null;
    const [userId, email, expStr, sig] = parts;
    const payload = `${userId}|${email}|${expStr}`;
    const expected = createHmac("sha256", otpPepper()).update(payload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Number(expStr) < Date.now()) return null;
    if (normalizeEmail(email) !== normalizeEmail(expectedEmail)) return null;
    return { userId, email: normalizeEmail(email) };
  } catch {
    return null;
  }
}
