import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";

export const CheckoutSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().trim().min(2).max(120),
  phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits"),
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
]);

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

export function sanitizeBlogHtml(input: string) {
  return DOMPurify.sanitize(input, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "style"],
  });
}

/** Allow only relative /uploads paths or https product placeholders */
export function sanitizeImageUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/products/") || trimmed.startsWith("/blog/") || trimmed.startsWith("/collections/") || trimmed.startsWith("/hero/") || trimmed.startsWith("/plp/") || trimmed.startsWith("/stitch/")) {
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
