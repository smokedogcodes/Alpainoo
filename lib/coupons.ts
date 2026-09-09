import type { Coupon } from "@prisma/client";
import { asD1, getD1, sqlNow, toBool, toDate } from "@/lib/db/d1";
import { formatINR } from "@/lib/utils";

export type CouponKind = "PERCENT" | "FIXED" | "PERCENT_CAPPED" | "FREE_SHIPPING";

function mapCoupon(row: Record<string, unknown>): Coupon {
  return {
    id: String(row.id),
    code: String(row.code),
    description: row.description != null ? String(row.description) : null,
    kind: row.kind != null ? String(row.kind) : null,
    percentOff: row.percentOff != null ? Number(row.percentOff) : null,
    amountOff: row.amountOff != null ? Number(row.amountOff) : null,
    minOrder: Number(row.minOrder ?? 0),
    maxUses: row.maxUses != null ? Number(row.maxUses) : null,
    usedCount: Number(row.usedCount ?? 0),
    active: toBool(row.active),
    startsAt: row.startsAt != null ? toDate(row.startsAt) : null,
    endsAt: row.endsAt != null ? toDate(row.endsAt) : null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

/** Infer kind for older rows that predate the `kind` column. */
export function resolveCouponKind(coupon: Coupon): CouponKind {
  const k = (coupon.kind || "").toUpperCase();
  if (k === "PERCENT" || k === "FIXED" || k === "PERCENT_CAPPED" || k === "FREE_SHIPPING") {
    return k;
  }
  if (coupon.percentOff != null && coupon.percentOff > 0 && coupon.amountOff != null && coupon.amountOff > 0) {
    return "PERCENT_CAPPED";
  }
  if (coupon.percentOff != null && coupon.percentOff > 0) return "PERCENT";
  if (coupon.amountOff != null && coupon.amountOff > 0) return "FIXED";
  return "FIXED";
}

export async function findCouponByCode(code: string): Promise<Coupon | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const db = await getD1();
  if (db) {
    const row = await asD1(db)
      .prepare(`SELECT * FROM Coupon WHERE upper(code) = ? LIMIT 1`)
      .bind(normalized)
      .first();
    return row ? mapCoupon(row as Record<string, unknown>) : null;
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.coupon.findFirst({
    where: { code: { equals: normalized } },
  });
}

export function couponLabel(coupon: Coupon) {
  const kind = resolveCouponKind(coupon);
  if (kind === "FREE_SHIPPING") return "Free shipping";
  if (kind === "PERCENT_CAPPED" && coupon.percentOff != null && coupon.amountOff != null) {
    return `${coupon.percentOff}% off up to ${formatINR(coupon.amountOff)}`;
  }
  if (kind === "PERCENT" && coupon.percentOff != null) return `${coupon.percentOff}% off`;
  if (kind === "FIXED" && coupon.amountOff != null) return `${formatINR(coupon.amountOff)} off`;
  if (coupon.percentOff) return `${coupon.percentOff}% off`;
  if (coupon.amountOff) return `${formatINR(coupon.amountOff)} off`;
  return coupon.description || "Discount applied";
}

export function formatCouponDiscountCell(coupon: Coupon) {
  const kind = resolveCouponKind(coupon);
  const parts: string[] = [];
  if (kind === "FREE_SHIPPING") parts.push("Free shipping");
  else if (kind === "PERCENT_CAPPED") {
    parts.push(`${coupon.percentOff}% up to ${formatINR(coupon.amountOff || 0)}`);
  } else if (kind === "PERCENT") {
    parts.push(`${coupon.percentOff}%`);
  } else if (kind === "FIXED") {
    parts.push(formatINR(coupon.amountOff || 0));
  } else {
    if (coupon.percentOff != null) parts.push(`${coupon.percentOff}%`);
    if (coupon.amountOff != null) parts.push(formatINR(coupon.amountOff));
  }
  if (coupon.minOrder > 0) parts.push(`min ${formatINR(coupon.minOrder)}`);
  return parts.join(" · ");
}

export type CouponApplyResult = {
  total: number;
  discount: number;
  coupon: Coupon;
  label: string;
  freeShipping: boolean;
  kind: CouponKind;
};

/** Validates coupon against cart total and returns discounted amount. Throws with a user-facing reason. */
export async function applyCouponToTotal(code: string, total: number): Promise<CouponApplyResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new Error("Enter a coupon code");

  const coupon = await findCouponByCode(normalized);
  if (!coupon || !coupon.active) {
    throw new Error("This coupon code is not valid");
  }

  const now = Date.now();
  if (coupon.startsAt && coupon.startsAt.getTime() > now) {
    throw new Error("This coupon is not active yet");
  }
  if (coupon.endsAt && coupon.endsAt.getTime() < now) {
    throw new Error("This coupon has expired");
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    throw new Error("This coupon has reached its usage limit");
  }
  if (total < coupon.minOrder) {
    throw new Error(
      `Minimum order of ${formatINR(coupon.minOrder)} required to use this coupon (your cart is ${formatINR(total)})`
    );
  }

  const kind = resolveCouponKind(coupon);

  if (kind === "FREE_SHIPPING") {
    return {
      total,
      discount: 0,
      coupon,
      label: couponLabel(coupon),
      freeShipping: true,
      kind,
    };
  }

  let discount = 0;

  if (kind === "PERCENT") {
    if (!coupon.percentOff || coupon.percentOff <= 0) {
      throw new Error("This coupon has no discount configured");
    }
    discount = total * (coupon.percentOff / 100);
  } else if (kind === "FIXED") {
    if (!coupon.amountOff || coupon.amountOff <= 0) {
      throw new Error("This coupon has no discount configured");
    }
    discount = coupon.amountOff;
  } else if (kind === "PERCENT_CAPPED") {
    if (!coupon.percentOff || coupon.percentOff <= 0) {
      throw new Error("This coupon has no discount configured");
    }
    const raw = total * (coupon.percentOff / 100);
    const cap = coupon.amountOff != null && coupon.amountOff > 0 ? coupon.amountOff : raw;
    discount = Math.min(raw, cap);
  } else {
    throw new Error("This coupon has no discount configured");
  }

  discount = Math.min(discount, total);
  discount = Math.round(discount * 100) / 100;
  const next = Math.round((total - discount) * 100) / 100;

  return {
    total: next,
    discount,
    coupon,
    label: couponLabel(coupon),
    freeShipping: false,
    kind,
  };
}

/** Increment usedCount after a coupon is attached to an order. */
export async function redeemCoupon(code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  const db = await getD1();
  if (db) {
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `UPDATE Coupon SET usedCount = usedCount + 1, updatedAt = ? WHERE upper(code) = ?`
      )
      .bind(now, normalized)
      .run();
    return;
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const coupon = await prisma.coupon.findFirst({
    where: { code: { equals: normalized } },
  });
  if (!coupon) return;
  await prisma.coupon.update({
    where: { id: coupon.id },
    data: { usedCount: { increment: 1 } },
  });
}

export async function listCoupons() {
  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(`SELECT * FROM Coupon ORDER BY createdAt DESC`)
      .all();
    return (res.results || []).map((r: Record<string, unknown>) => mapCoupon(r));
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}
