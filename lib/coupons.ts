import type { Coupon } from "@prisma/client";
import { asD1, getD1, toBool, toDate } from "@/lib/db/d1";

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

export async function applyCouponToTotal(code: string, total: number) {
  const coupon = await findCouponByCode(code);
  if (!coupon || !coupon.active) throw new Error("Invalid coupon");
  const now = Date.now();
  if (coupon.startsAt && coupon.startsAt.getTime() > now) throw new Error("Coupon not started");
  if (coupon.endsAt && coupon.endsAt.getTime() < now) throw new Error("Coupon expired");
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    throw new Error("Coupon fully redeemed");
  }
  if (total < coupon.minOrder) {
    throw new Error(`Minimum order ${coupon.minOrder} required`);
  }

  let next = total;
  if (coupon.percentOff) next = total * (1 - coupon.percentOff / 100);
  if (coupon.amountOff) next = Math.max(0, next - coupon.amountOff);
  return { total: Math.round(next * 100) / 100, coupon };
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
