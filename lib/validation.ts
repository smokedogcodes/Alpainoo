import { z } from "zod";
import { sanitizePlainText } from "@/lib/security/sanitize-text";

const plain = (min: number, max: number) =>
  z
    .string()
    .transform((v) => sanitizePlainText(v, max))
    .pipe(z.string().min(min).max(max));

export const CheckoutSchema = z.object({
  email: z.string().email().max(254).transform((v) => sanitizePlainText(v.toLowerCase(), 254)),
  name: plain(2, 120),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .transform((v) => (v.length > 10 && v.startsWith("91") ? v.slice(-10) : v))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")),
  address: plain(5, 500),
  city: plain(2, 100),
  state: plain(2, 100),
  pincode: z.string().regex(/^\d{6}$/, "Pin code must be 6 digits"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .min(1)
    .max(50),
});

export const OrderStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "CANCEL_REQUESTED",
  "REFUNDED",
]);

export const ORDER_STATUSES = OrderStatusSchema.options;

export const PincodeSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/),
});

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
});

export const VerifyPaymentSchema = z.object({
  orderId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  razorpayOrderId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  razorpayPaymentId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  razorpaySignature: z.string().min(1).max(256).regex(/^[a-zA-Z0-9+/=_-]+$/),
});

/** Allow only relative /uploads paths or https product placeholders */
export function sanitizeImageUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("/uploads/") ||
    trimmed.startsWith("/api/uploads/") ||
    trimmed.startsWith("/api/media/") ||
    trimmed.startsWith("/products/") ||
    trimmed.startsWith("/blog/") ||
    trimmed.startsWith("/collections/") ||
    trimmed.startsWith("/hero/") ||
    trimmed.startsWith("/plp/") ||
    trimmed.startsWith("/stitch/")
  ) {
    return trimmed;
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol === "https:") return trimmed;
  } catch {
    /* ignore */
  }
  return "";
}
