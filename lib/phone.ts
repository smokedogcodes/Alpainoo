import { z } from "zod";

/** Strip to digits; fold leading 91 into last 10 for Indian mobiles. */
export function digitsOnly(input: string) {
  return String(input || "").replace(/\D/g, "");
}

export function toLocal10(input: string): string | null {
  let d = digitsOnly(input);
  if (d.length > 10 && d.startsWith("91")) d = d.slice(-10);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  return d;
}

/** E.164 without plus for India: 91XXXXXXXXXX */
export function toE164India(input: string): string | null {
  const local = toLocal10(input);
  return local ? `91${local}` : null;
}

export function maskPhone(local10: string) {
  if (local10.length !== 10) return local10;
  return `${local10.slice(0, 2)}****${local10.slice(-4)}`;
}

export function phoneStatus(phone: string | null | undefined, phoneVerifiedAt: Date | null | undefined) {
  if (!phone || !toLocal10(phone)) return "unverified" as const;
  if (phoneVerifiedAt) return "verified" as const;
  return "unverified" as const;
}

export const IndianMobileSchema = z
  .string()
  .transform((v) => digitsOnly(v))
  .transform((v) => (v.length > 10 && v.startsWith("91") ? v.slice(-10) : v))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));

export const OptionalIndianMobileSchema = z
  .string()
  .transform((v) => digitsOnly(v))
  .transform((v) => (v.length > 10 && v.startsWith("91") ? v.slice(-10) : v))
  .pipe(
    z.union([
      z.literal(""),
      z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
    ])
  );
