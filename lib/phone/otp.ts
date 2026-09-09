import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { emailConfigured, sendTransactionalEmail } from "@/lib/email/resend";
import { phoneOtpEmail } from "@/lib/email/templates";
import {
  deletePhoneOtp,
  findPhoneOtpByUserId,
  incrementPhoneOtpAttempts,
  upsertPhoneOtp,
} from "@/lib/db/phone-otp";
import { markPhoneVerified } from "@/lib/db/users";
import { maskPhone, toLocal10 } from "@/lib/phone";

export const OTP_LENGTH = 4;
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60_000;

function otpPepper() {
  return (
    process.env.OTP_PEPPER?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "dev-otp-pepper"
  );
}

function hashOtp(code: string, userId: string, phone: string) {
  return createHmac("sha256", otpPepper())
    .update(`${userId}:${phone}:${code}`)
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
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

export type SendPhoneOtpResult =
  | { ok: true; cooldownSeconds: number; maskedPhone: string }
  | { ok: false; error: string; cooldownSeconds?: number };

export async function sendPhoneOtp(input: {
  userId: string;
  email: string;
  phone: string;
}): Promise<SendPhoneOtpResult> {
  const phone = toLocal10(input.phone);
  if (!phone) {
    return { ok: false, error: "Enter a valid 10-digit Indian mobile number" };
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "Your verified email is required to send the code" };
  }

  if (!emailConfigured()) {
    return { ok: false, error: "Email delivery is not configured. Please try again later." };
  }

  const existing = await findPhoneOtpByUserId(input.userId);
  if (existing) {
    const waitMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime());
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
  await upsertPhoneOtp({
    userId: input.userId,
    phone,
    codeHash: hashOtp(code, input.userId, phone),
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    lastSentAt: now,
  });

  const template = phoneOtpEmail({
    code,
    phoneMasked: maskPhone(phone),
    expiresMinutes: Math.round(OTP_TTL_MS / 60_000),
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

  return {
    ok: true,
    cooldownSeconds: Math.round(OTP_RESEND_COOLDOWN_MS / 1000),
    maskedPhone: maskPhone(phone),
  };
}

export type VerifyPhoneOtpResult =
  | { ok: true }
  | { ok: false; error: string };

export async function verifyPhoneOtp(input: {
  userId: string;
  phone: string;
  otp: string;
}): Promise<VerifyPhoneOtpResult> {
  const phone = toLocal10(input.phone);
  if (!phone) {
    return { ok: false, error: "Enter a valid 10-digit Indian mobile number" };
  }

  const otp = String(input.otp || "").replace(/\D/g, "");
  if (otp.length !== OTP_LENGTH) {
    return { ok: false, error: `Enter the ${OTP_LENGTH}-digit code from your email` };
  }

  const row = await findPhoneOtpByUserId(input.userId);
  if (!row || row.phone !== phone) {
    return { ok: false, error: "Request a new code for this number" };
  }

  if (row.expiresAt.getTime() < Date.now()) {
    await deletePhoneOtp(input.userId);
    return { ok: false, error: "Code expired. Request a new one." };
  }

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await deletePhoneOtp(input.userId);
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  const expected = hashOtp(otp, input.userId, phone);
  if (!safeEqualHex(expected, row.codeHash)) {
    await incrementPhoneOtpAttempts(input.userId);
    return { ok: false, error: "Incorrect code. Try again." };
  }

  await markPhoneVerified(input.userId, phone);
  await deletePhoneOtp(input.userId);
  return { ok: true };
}
