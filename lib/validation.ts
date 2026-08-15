import { z } from "zod";

export const CheckoutSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .transform((v) => (v.length > 10 && v.startsWith("91") ? v.slice(-10) : v))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")),
  address: z.string().trim().min(5).max(500),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, "Pin code must be 6 digits"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
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
]);

export const ORDER_STATUSES = OrderStatusSchema.options;

export const PincodeSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/),
});

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
});

export const VerifyPaymentSchema = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

/** Allow only relative /uploads paths or https product placeholders */
export function sanitizeImageUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("/uploads/") ||
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
