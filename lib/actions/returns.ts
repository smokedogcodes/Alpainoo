"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/auth/admin";
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
  await requireAdmin();

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

export async function updateReturnStatus(
  id: string,
  status: string,
  adminNote?: string
) {
  await requireAdmin();
  const parsed = StatusSchema.safeParse(status);
  if (!parsed.success) throw new Error("Invalid status");
  if (!id) throw new Error("Invalid return");

  const note = adminNote?.trim() || null;

  const db = await getD1();
  if (db) {
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `UPDATE ReturnRequest SET status = ?, adminNote = COALESCE(?, adminNote), updatedAt = ? WHERE id = ?`
      )
      .bind(parsed.data, note, now, id)
      .run();
    revalidatePath("/admin/returns");
    return { ok: true as const };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  await prisma.returnRequest.update({
    where: { id },
    data: {
      status: parsed.data,
      ...(note != null ? { adminNote: note } : {}),
    },
  });
  revalidatePath("/admin/returns");
  return { ok: true as const };
}
