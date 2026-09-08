import type { Coupon } from "@prisma/client";
import { asD1, getD1, sqlNow, toBool, toDate } from "@/lib/db/d1";
import { formatINR } from "@/lib/utils";

function mapCoupon(row: Record<string, unknown>): Coupon {
  return {
    id: String(row.id),
    code: String(row.code),
    description: row.description != null ? String(row.description) : null,
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

function couponLabel(coupon: Coupon) {
  if (coupon.percentOff) return `${coupon.percentOff}% off`;
  if (coupon.amountOff) return `${formatINR(coupon.amountOff)} off`;
  return coupon.description || "Discount applied";
}

export type CouponApplyResult = {
  total: number;
  discount: number;
  coupon: Coupon;
  label: string;
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
  if (!coupon.percentOff && !coupon.amountOff) {
    throw new Error("This coupon has no discount configured");
  }

  let next = total;
  if (coupon.percentOff) next = total * (1 - coupon.percentOff / 100);
  if (coupon.amountOff) next = Math.max(0, next - coupon.amountOff);
  next = Math.round(next * 100) / 100;
  const discount = Math.round((total - next) * 100) / 100;

  return {
    total: next,
    discount,
    coupon,
    label: couponLabel(coupon),
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
