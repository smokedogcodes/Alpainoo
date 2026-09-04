import { asD1, getD1 } from "@/lib/db/d1";

export type UserSegment = {
  userId: string | null;
  email: string;
  orderCount: number;
  totalSpend: number;
  segment: "repeat_buyer" | "high_value";
};

const HIGH_VALUE_THRESHOLD = 5000;

/**
 * Segment shoppers from paid orders: repeat buyers (2+) and high-value spenders.
 */
export async function segmentUsers(): Promise<UserSegment[]> {
  type Agg = { userId: string | null; email: string; orderCount: number; totalSpend: number };

  const byEmail = new Map<string, Agg>();

  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(
        `SELECT userId, email, COUNT(*) as orderCount, SUM(totalAmount) as totalSpend
         FROM "Order"
         WHERE paymentStatus = 'PAID'
         GROUP BY email`
      )
      .all();
    for (const row of (res.results || []) as Record<string, unknown>[]) {
      const email = String(row.email || "").toLowerCase();
      if (!email) continue;
      byEmail.set(email, {
        userId: row.userId != null ? String(row.userId) : null,
        email,
        orderCount: Number(row.orderCount ?? 0),
        totalSpend: Number(row.totalSpend ?? 0),
      });
    }
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const orders = await prisma.order.findMany({
      where: { paymentStatus: "PAID" },
      select: { userId: true, email: true, totalAmount: true },
    });
    for (const o of orders) {
      const email = o.email.toLowerCase();
      const prev = byEmail.get(email) || {
        userId: o.userId,
        email,
        orderCount: 0,
        totalSpend: 0,
      };
      prev.orderCount += 1;
      prev.totalSpend += o.totalAmount;
      if (o.userId) prev.userId = o.userId;
      byEmail.set(email, prev);
    }
  }

  return Array.from(byEmail.values()).flatMap((agg) => {
    const out: UserSegment[] = [];
    if (agg.orderCount >= 2) {
      out.push({ ...agg, segment: "repeat_buyer" });
    }
    if (agg.totalSpend >= HIGH_VALUE_THRESHOLD) {
      out.push({ ...agg, segment: "high_value" });
    }
    return out;
  });
}
