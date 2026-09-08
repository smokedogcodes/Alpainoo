"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/admin";
import { asD1, getD1, sqlNow } from "@/lib/db/d1";
import { createRefund } from "@/lib/razorpay";

export async function refundOrder(orderId: string) {
  await requirePermission("orders", "edit");
  if (!orderId) throw new Error("Invalid order");

  const db = await getD1();
  if (db) {
    const order = await asD1(db)
      .prepare(
        `SELECT id, orderNumber, email, totalAmount, paymentStatus, orderStatus, razorpayPaymentId
         FROM "Order" WHERE id = ? LIMIT 1`
      )
      .bind(orderId)
      .first();
    if (!order) throw new Error("Order not found");
    if (String(order.paymentStatus) !== "PAID") {
      throw new Error("Only paid orders can be refunded");
    }

    const paymentId = order.razorpayPaymentId != null ? String(order.razorpayPaymentId) : "";
    if (paymentId) {
      await createRefund(paymentId, {
        notes: { orderId, orderNumber: String(order.orderNumber) },
      });
    }

    const now = sqlNow();
    await asD1(db)
      .prepare(
        `UPDATE "Order" SET paymentStatus = 'REFUNDED', orderStatus = 'REFUNDED', updatedAt = ? WHERE id = ?`
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
      .catch((err) => console.error("[email] refund notify:", err));

    revalidatePath("/admin/orders");
    revalidatePath(`/orders/${orderId}`);
    return { ok: true as const };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, shipment: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.paymentStatus !== "PAID") {
    throw new Error("Only paid orders can be refunded");
  }

  if (order.razorpayPaymentId) {
    await createRefund(order.razorpayPaymentId, {
      notes: { orderId: order.id, orderNumber: order.orderNumber },
    });
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: "REFUNDED", orderStatus: "REFUNDED" },
    include: { items: { include: { product: true } }, shipment: true },
  });

  void import("@/lib/email/orders")
    .then(({ notifyOrderRefunded }) => notifyOrderRefunded(updated))
    .catch((err) => console.error("[email] refund notify:", err));

  void import("@/lib/logging/system-log").then(({ logSuccess }) =>
    logSuccess({
      category: "admin",
      action: "ORDER_REFUNDED",
      message: `Refunded ${order.orderNumber}`,
      entityType: "Order",
      entityId: orderId,
      actorEmail: order.email,
    })
  );

  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true as const };
}
