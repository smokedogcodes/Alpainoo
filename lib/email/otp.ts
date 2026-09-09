import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { emailConfigured, sendTransactionalEmail } from "@/lib/email/resend";
import { emailOtpEmail } from "@/lib/email/templates";
import {
  deleteEmailOtp,
  findEmailOtpByEmail,
  incrementEmailOtpAttempts,
  upsertEmailOtp,
} from "@/lib/db/email-otp";
import { markEmailVerified, upsertUserByEmail } from "@/lib/db/users";
import { createEmailLoginTicket } from "@/lib/auth/email-login-ticket";

export { createEmailLoginTicket, verifyEmailLoginTicket } from "@/lib/auth/email-login-ticket";

export const EMAIL_OTP_LENGTH = 4;
export const EMAIL_OTP_TTL_MS = 5 * 60_000;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;
export const EMAIL_OTP_RESEND_COOLDOWN_MS = 60_000;

function otpPepper() {
  return (
    process.env.OTP_PEPPER?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "dev-otp-pepper"
  );
}

function hashOtp(code: string, email: string) {
  return createHmac("sha256", otpPepper())
    .update(`email:${email}:${code}`)
    .digest("hex");
}

function safeEqualHex(a: string, b: string) {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function generateCode() {
  return String(randomInt(0, 10 ** EMAIL_OTP_LENGTH)).padStart(EMAIL_OTP_LENGTH, "0");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type SendEmailOtpResult =
  | { ok: true; cooldownSeconds: number }
  | { ok: false; error: string; cooldownSeconds?: number };

export async function sendEmailOtp(input: {
  email: string;
}): Promise<SendEmailOtpResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email address" };
  }

  if (!emailConfigured()) {
    return { ok: false, error: "Email delivery is not configured. Please try again later." };
  }

  const existing = await findEmailOtpByEmail(email);
  if (existing) {
    const waitMs = EMAIL_OTP_RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime());
    if (waitMs > 0) {
      return {
        ok: false,
        error: `Please wait ${Math.ceil(waitMs / 1000)}s before requesting another code`,
        cooldownSeconds: Math.ceil(waitMs / 1000),
      };
    }
  }

  const code = generateCode();
  const now = new Date();
  await upsertEmailOtp({
    email,
    codeHash: hashOtp(code, email),
    expiresAt: new Date(now.getTime() + EMAIL_OTP_TTL_MS),
    lastSentAt: now,
  });

  const template = emailOtpEmail({
    code,
    expiresMinutes: Math.round(EMAIL_OTP_TTL_MS / 60_000),
  });

  const sent = await sendTransactionalEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  if ("skipped" in sent && sent.skipped) {
    return { ok: false, error: "Could not send verification email. Please try again later." };
  }
  if ("ok" in sent && sent.ok === false) {
    return { ok: false, error: "Could not send verification email. Please try again later." };
  }

  return { ok: true, cooldownSeconds: Math.round(EMAIL_OTP_RESEND_COOLDOWN_MS / 1000) };
}

export type VerifyEmailOtpResult =
  | { ok: true; ticket: string; email: string; userId: string }
  | { ok: false; error: string };

export async function verifyEmailOtp(input: {
  email: string;
  otp: string;
  name?: string | null;
}): Promise<VerifyEmailOtpResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email address" };
  }

  const otp = String(input.otp || "").replace(/\D/g, "");
  if (otp.length !== EMAIL_OTP_LENGTH) {
    return { ok: false, error: `Enter the ${EMAIL_OTP_LENGTH}-digit code from your email` };
  }

  const row = await findEmailOtpByEmail(email);
  if (!row) {
    return { ok: false, error: "Request a new code for this email" };
  }

  if (row.expiresAt.getTime() < Date.now()) {
    await deleteEmailOtp(email);
    return { ok: false, error: "Code expired. Request a new one." };
  }

  if (row.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    await deleteEmailOtp(email);
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  const expected = hashOtp(otp, email);
  if (!safeEqualHex(expected, row.codeHash)) {
    await incrementEmailOtpAttempts(email);
    return { ok: false, error: "Incorrect code. Try again." };
  }

  const user = await upsertUserByEmail({
    email,
    name: input.name?.trim() || null,
  });
  await markEmailVerified(user.id);
  await deleteEmailOtp(email);

  const ticket = createEmailLoginTicket(user.id, email);
  return { ok: true, ticket, email, userId: user.id };
}
