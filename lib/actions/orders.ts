"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { asD1, getD1, sqlNow } from "@/lib/db/d1";
import { findOrderById } from "@/lib/db/orders";

const CancelSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

const CANCELLABLE = new Set(["PENDING", "PAID", "PROCESSING"]);

async function assertOrderOwner(orderId: string) {
  const session = await auth();
  if (!session?.user?.id && !session?.user?.email) {
    throw new Error("Please sign in");
  }

  const order = await findOrderById(orderId);
  if (!order) throw new Error("Order not found");

  const ownsById = session.user.id && order.userId === session.user.id;
  const ownsByEmail =
    session.user.email &&
    order.email.toLowerCase() === session.user.email.toLowerCase();
  if (!ownsById && !ownsByEmail) throw new Error("Order not found");

  return order;
}

export async function requestOrderCancel(orderId: string, reason: string) {
  const parsed = CancelSchema.safeParse({ orderId, reason });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid request");

  const order = await assertOrderOwner(parsed.data.orderId);

  if (order.orderStatus === "CANCEL_REQUESTED") {
    throw new Error("Cancel request already submitted");
  }
  if (order.orderStatus === "CANCELLED") {
    throw new Error("Order is already cancelled");
  }
  if (!CANCELLABLE.has(order.orderStatus)) {
    throw new Error("This order can no longer be cancelled online");
  }

  const db = await getD1();
  if (db) {
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `UPDATE "Order"
         SET previousOrderStatus = ?, orderStatus = ?, cancelRequestedAt = ?, cancelReason = ?, updatedAt = ?
         WHERE id = ?`
      )
      .bind(
        order.orderStatus,
        "CANCEL_REQUESTED",
        now,
        parsed.data.reason,
        now,
        order.id
      )
      .run();
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.order.update({
      where: { id: order.id },
      data: {
        previousOrderStatus: order.orderStatus,
        orderStatus: "CANCEL_REQUESTED",
        cancelRequestedAt: new Date(),
        cancelReason: parsed.data.reason,
      },
    });
  }

  void import("@/lib/email/orders")
    .then(({ notifyCancelRequested }) =>
      notifyCancelRequested({
        ...order,
        orderStatus: "CANCEL_REQUESTED",
        cancelReason: parsed.data.reason,
      })
    )
    .catch((err) => console.error("[email] cancel request notify:", err));

  void import("@/lib/logging/system-log").then(({ logSuccess }) =>
    logSuccess({
      category: "order",
      action: "CANCEL_REQUESTED",
      message: `Cancel requested for ${order.orderNumber}`,
      entityType: "Order",
      entityId: order.id,
      actorEmail: order.email,
      meta: { reason: parsed.data.reason },
    })
  );

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}
