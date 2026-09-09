"use server";

import { applyCouponToTotal } from "@/lib/coupons";

export type PreviewCouponResult =
  | {
      ok: true;
      code: string;
      subtotal: number;
      discount: number;
      total: number;
      label: string;
      description: string | null;
      freeShipping: boolean;
    }
  | { ok: false; error: string };

export async function previewCoupon(code: string, subtotal: number): Promise<PreviewCouponResult> {
  try {
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return { ok: false, error: "Add items to your cart before applying a coupon" };
    }
    const result = await applyCouponToTotal(code, subtotal);
    return {
      ok: true,
      code: result.coupon.code.toUpperCase(),
      subtotal,
      discount: result.discount,
      total: result.total,
      label: result.label,
      description: result.coupon.description,
      freeShipping: result.freeShipping,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not apply coupon",
    };
  }
}
