"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/auth/admin";
import { asD1, cuidLike, getD1, sqlNow, toDate } from "@/lib/db/d1";

const RequestSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3).max(1000),
});

export type ReturnRequestItem = {
  id: string;
  orderId: string;
  userId: string | null;
  reason: string;
  status: string;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapReturn(row: Record<string, unknown>): ReturnRequestItem {
  return {
    id: String(row.id),
    orderId: String(row.orderId),
    userId: row.userId != null ? String(row.userId) : null,
    reason: String(row.reason),
    status: String(row.status ?? "REQUESTED"),
    adminNote: row.adminNote != null ? String(row.adminNote) : null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export async function requestReturn(orderId: string, reason: string) {
  const parsed = RequestSchema.safeParse({ orderId, reason });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid request");

  const session = await auth();
  if (!session?.user?.id && !session?.user?.email) {
    throw new Error("Please sign in");
  }
  const userId = session.user?.id || null;

  const db = await getD1();
  if (db) {
    const order = await asD1(db)
      .prepare(`SELECT id, userId, email FROM "Order" WHERE id = ? LIMIT 1`)
      .bind(parsed.data.orderId)
      .first();
    if (!order) throw new Error("Order not found");
    const owns =
      (userId && String(order.userId) === userId) ||
      (session.user?.email && String(order.email) === session.user.email);
    if (!owns) throw new Error("Order not found");

    const id = cuidLike();
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `INSERT INTO ReturnRequest (id, orderId, userId, reason, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 'REQUESTED', ?, ?)`
      )
      .bind(id, parsed.data.orderId, userId, parsed.data.reason, now, now)
      .run();
    revalidatePath(`/orders/${parsed.data.orderId}`);
    return { id };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const order = await prisma.order.findFirst({
    where: {
      id: parsed.data.orderId,
      OR: [
        ...(userId ? [{ userId }] : []),
        ...(session.user?.email ? [{ email: session.user.email }] : []),
      ],
    },
  });
  if (!order) throw new Error("Order not found");

  const created = await prisma.returnRequest.create({
    data: {
      orderId: order.id,
      userId,
      reason: parsed.data.reason,
      status: "REQUESTED",
    },
  });
  revalidatePath(`/orders/${order.id}`);
  return { id: created.id };
}

/** Admin stub — list recent return requests. */
export async function listReturns(take = 50): Promise<ReturnRequestItem[]> {
  await requirePermission("returns", "view");

  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(`SELECT * FROM ReturnRequest ORDER BY createdAt DESC LIMIT ?`)
      .bind(take)
      .all();
    return (res.results || []).map((r: Record<string, unknown>) => mapReturn(r));
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const rows = await prisma.returnRequest.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    userId: r.userId,
    reason: r.reason,
    status: r.status,
    adminNote: r.adminNote,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

const StatusSchema = z.enum(["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "REFUNDED"]);

async function refundPaidOrderForReturn(orderId: string) {
  const db = await getD1();
  if (db) {
    const order = await asD1(db)
      .prepare(
        `SELECT id, orderNumber, email, totalAmount, paymentStatus, razorpayPaymentId
         FROM "Order" WHERE id = ? LIMIT 1`
      )
      .bind(orderId)
      .first();
    if (!order) throw new Error("Order not found");
    const paymentStatus = String(order.paymentStatus);
    if (paymentStatus === "REFUNDED") return { refunded: true as const };
    if (paymentStatus !== "PAID") return { refunded: false as const };

    const paymentId =
      order.razorpayPaymentId != null ? String(order.razorpayPaymentId) : "";
    if (paymentId) {
      try {
        const { createRefund } = await import("@/lib/razorpay");
        await createRefund(paymentId, {
          notes: {
            orderId,
            orderNumber: String(order.orderNumber),
            reason: "return_approved",
          },
        });
      } catch (err) {
        console.error("[refund] return approve:", err);
        throw new Error(
          "Could not refund payment automatically. Retry refund from admin, then approve return."
        );
      }
    }

    const now = sqlNow();
    await asD1(db)
      .prepare(
        `UPDATE "Order" SET paymentStatus = 'REFUNDED', updatedAt = ? WHERE id = ?`
      )
      .bind(now, orderId)
      .run();

    void import("@/lib/email/orders")
      .then(({ notifyOrderRefunded }) =>
        notifyOrderRefunded({
          id: String(order.id),
          orderNumber: String(order.orderNumber),
          email: String(order.email),
          totalAmount: Number(order.totalAmount),
          orderStatus: "REFUNDED",
        })
      )
      .catch((err) => console.error("[email] return refund notify:", err));

    return { refunded: true as const };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, shipment: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.paymentStatus === "REFUNDED") return { refunded: true as const };
  if (order.paymentStatus !== "PAID") return { refunded: false as const };

  if (order.razorpayPaymentId) {
    try {
      const { createRefund } = await import("@/lib/razorpay");
      await createRefund(order.razorpayPaymentId, {
        notes: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: "return_approved",
        },
      });
    } catch (err) {
      console.error("[refund] return approve:", err);
      throw new Error(
        "Could not refund payment automatically. Retry refund from admin, then approve return."
      );
    }
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: "REFUNDED" },
    include: { items: { include: { product: true } }, shipment: true },
  });

  void import("@/lib/email/orders")
    .then(({ notifyOrderRefunded }) => notifyOrderRefunded(updated))
    .catch((err) => console.error("[email] return refund notify:", err));

  return { refunded: true as const };
}

export async function updateReturnStatus(
  id: string,
  status: string,
  adminNote?: string
) {
  await requirePermission("returns", "edit");
  const parsed = StatusSchema.safeParse(status);
  if (!parsed.success) throw new Error("Invalid status");
  if (!id) throw new Error("Invalid return");

  const note = adminNote?.trim() || null;
  let nextStatus: z.infer<typeof StatusSchema> = parsed.data;

  const db = await getD1();
  if (db) {
    const row = await asD1(db)
      .prepare(`SELECT id, orderId, status FROM ReturnRequest WHERE id = ? LIMIT 1`)
      .bind(id)
      .first();
    if (!row) throw new Error("Return not found");

    if (parsed.data === "APPROVED") {
      const result = await refundPaidOrderForReturn(String(row.orderId));
      if (result.refunded) nextStatus = "REFUNDED";
    }

    const now = sqlNow();
    await asD1(db)
      .prepare(
        `UPDATE ReturnRequest SET status = ?, adminNote = COALESCE(?, adminNote), updatedAt = ? WHERE id = ?`
      )
      .bind(nextStatus, note, now, id)
      .run();
    revalidatePath("/admin/returns");
    revalidatePath("/admin/orders");
    revalidatePath(`/orders/${String(row.orderId)}`);
    return { ok: true as const, status: nextStatus };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const existing = await prisma.returnRequest.findUnique({ where: { id } });
  if (!existing) throw new Error("Return not found");

  if (parsed.data === "APPROVED") {
    const result = await refundPaidOrderForReturn(existing.orderId);
    if (result.refunded) nextStatus = "REFUNDED";
  }

  await prisma.returnRequest.update({
    where: { id },
    data: {
      status: nextStatus,
      ...(note != null ? { adminNote: note } : {}),
    },
  });
  revalidatePath("/admin/returns");
  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${existing.orderId}`);
  return { ok: true as const, status: nextStatus };
}
