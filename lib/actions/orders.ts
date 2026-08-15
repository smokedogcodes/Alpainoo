"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      OR: [
        ...(session.user.id ? [{ userId: session.user.id }] : []),
        ...(session.user.email ? [{ email: session.user.email }] : []),
      ],
    },
  });

  if (!order) throw new Error("Order not found");
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

  await prisma.order.update({
    where: { id: order.id },
    data: {
      previousOrderStatus: order.orderStatus,
      orderStatus: "CANCEL_REQUESTED",
      cancelRequestedAt: new Date(),
      cancelReason: parsed.data.reason,
    },
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}
