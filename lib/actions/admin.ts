"use server";

import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { requireAdmin, requirePermission } from "@/lib/auth/admin";
import { OrderStatusSchema, sanitizeImageUrl } from "@/lib/validation";
import { sanitizeBlogHtml } from "@/lib/sanitize-html";
import { asD1, cuidLike, getD1, sqlNow } from "@/lib/db/d1";
import { findOrderById } from "@/lib/db/orders";
import { findUserById, updateUserAccess } from "@/lib/db/users";
import { deleteBlogPost, upsertBlogPost } from "@/lib/db/blog";
import type { AssignableRole, PermissionMatrix } from "@/lib/auth/permissions";
import { serializePermissionMatrix } from "@/lib/auth/permissions";

export async function toggleHideProduct(id: string, isHidden: boolean) {
  await requirePermission("products", "edit");
  if (!id || typeof isHidden !== "boolean") throw new Error("Invalid input");

  const db = await getD1();
  if (db) {
    await asD1(db)
      .prepare(`UPDATE Product SET isHidden = ?, updatedAt = ? WHERE id = ?`)
      .bind(isHidden ? 1 : 0, sqlNow(), id)
      .run();
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.product.update({ where: { id }, data: { isHidden } });
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function deleteProduct(id: string) {
  await requirePermission("products", "delete");
  if (!id) throw new Error("Invalid product");

  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    const countRow = await d1
      .prepare(`SELECT COUNT(*) as c FROM OrderItem WHERE productId = ?`)
      .bind(id)
      .first();
    const items = Number((countRow as { c: number } | null)?.c ?? 0);
    if (items > 0) {
      await d1
        .prepare(`UPDATE Product SET isHidden = 1, updatedAt = ? WHERE id = ?`)
        .bind(sqlNow(), id)
        .run();
      return { soft: true };
    }
    await d1.prepare(`DELETE FROM Product WHERE id = ?`).bind(id).run();
    revalidatePath("/admin/products");
    return { soft: false };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const items = await prisma.orderItem.count({ where: { productId: id } });
  if (items > 0) {
    await prisma.product.update({ where: { id }, data: { isHidden: true } });
    return { soft: true };
  }
  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  return { soft: false };
}

export async function updateOrderStatus(id: string, orderStatus: string) {
  await requirePermission("orders", "edit");
  const status = OrderStatusSchema.parse(orderStatus);
  const existing = await findOrderById(id);
  if (!existing) throw new Error("Order not found");
  if (existing.orderStatus === status) {
    revalidatePath("/admin/orders");
    return;
  }

  const db = await getD1();
  if (db) {
    await asD1(db)
      .prepare(`UPDATE "Order" SET orderStatus = ?, updatedAt = ? WHERE id = ?`)
      .bind(status, sqlNow(), id)
      .run();
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.order.update({
      where: { id },
      data: { orderStatus: status },
    });
  }

  const updated = await findOrderById(id);
  if (!updated) throw new Error("Order not found after update");

  void import("@/lib/email/orders")
    .then(({ notifyOrderStatusChanged }) =>
      notifyOrderStatusChanged(updated, existing.orderStatus)
    )
    .catch((err) => console.error("[email] status notify:", err));

  if (status === "SHIPPED") {
    void import("@/lib/whatsapp")
      .then(({ notifyOrderShippedWhatsApp }) =>
        notifyOrderShippedWhatsApp(updated, updated.shipment?.trackingUrl)
      )
      .catch(() => undefined);
  }

  void import("@/lib/logging/system-log").then(({ logSuccess }) =>
    logSuccess({
      category: "admin",
      action: "ORDER_STATUS_CHANGED",
      message: `${existing.orderNumber}: ${existing.orderStatus} → ${status}`,
      entityType: "Order",
      entityId: id,
      actorEmail: existing.email,
      meta: { from: existing.orderStatus, to: status },
    })
  );

  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${id}`);
}

export async function upsertBlog(formData: FormData) {
  await requirePermission("blog", "edit");

  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = sanitizeBlogHtml(String(formData.get("content") || ""));
  const published = formData.get("published") === "on";
  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
  if (title.length < 2 || title.length > 200) throw new Error("Invalid title");
  if (excerpt.length > 500) throw new Error("Excerpt too long");

  const slug = slugify(title);
  const coverRaw = String(formData.get("coverImage") || "");
  const coverImage = sanitizeImageUrl(coverRaw) || null;
  const metaTitle = String(formData.get("metaTitle") || "").trim() || null;
  const metaDescription = String(formData.get("metaDescription") || "").trim() || null;
  const scheduledRaw = String(formData.get("scheduledAt") || "").trim();
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid schedule date");
  }

  await upsertBlogPost({
    id: id || undefined,
    title,
    slug,
    excerpt,
    content,
    published,
    tags: JSON.stringify(tags),
    coverImage,
    metaTitle,
    metaDescription,
    scheduledAt,
  });

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}

export async function deleteBlog(id: string) {
  await requirePermission("blog", "delete");
  if (!id) throw new Error("Invalid blog");
  await deleteBlogPost(id);
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}

export async function setUserAccess(input: {
  userId: string;
  role: AssignableRole;
  permissions: PermissionMatrix | null;
  roleExpiresAt: string | null;
  useRoleDefaults: boolean;
}) {
  await requireAdmin();
  const { userId, role } = input;
  if (!userId || !["ADMIN", "STAFF", "TEMP", "CUSTOMER"].includes(role)) {
    throw new Error("Invalid input");
  }

  if (role === "TEMP" && !input.roleExpiresAt) {
    throw new Error("Temp role requires an expiry date");
  }

  if (role !== "ADMIN") {
    const db = await getD1();
    if (db) {
      const countRow = await asD1(db)
        .prepare(`SELECT COUNT(*) as c FROM User WHERE role = 'ADMIN'`)
        .first();
      const admins = Number((countRow as { c: number } | null)?.c ?? 0);
      const target = await findUserById(userId);
      if (target?.role === "ADMIN" && admins <= 1) {
        throw new Error("Cannot remove the last admin");
      }
    } else {
      const { getPrismaAsync } = await import("@/lib/prisma");
      const prisma = await getPrismaAsync();
      const admins = await prisma.user.count({ where: { role: "ADMIN" } });
      const target = await prisma.user.findUnique({ where: { id: userId } });
      if (target?.role === "ADMIN" && admins <= 1) {
        throw new Error("Cannot remove the last admin");
      }
    }
  }

  const permissionsJson =
    role === "ADMIN" || role === "CUSTOMER" || input.useRoleDefaults || !input.permissions
      ? "[]"
      : serializePermissionMatrix(input.permissions);

  const expires =
    role === "TEMP" && input.roleExpiresAt ? new Date(input.roleExpiresAt) : null;
  if (role === "TEMP" && expires && Number.isNaN(expires.getTime())) {
    throw new Error("Invalid expiry date");
  }

  await updateUserAccess(userId, {
    role,
    permissions: permissionsJson,
    roleExpiresAt: expires,
  });

  void import("@/lib/logging/system-log").then(({ logSuccess }) =>
    logSuccess({
      category: "admin",
      action: "USER_ACCESS_CHANGED",
      message: `User access set to ${role}`,
      entityType: "User",
      entityId: userId,
      meta: {
        role,
        useRoleDefaults: input.useRoleDefaults,
        roleExpiresAt: expires?.toISOString() ?? null,
      },
    })
  );

  revalidatePath("/admin/users");
  revalidatePath("/admin/roles");
}

/** @deprecated Prefer setUserAccess — kept for simple ADMIN/CUSTOMER toggles */
export async function setUserRole(userId: string, role: "ADMIN" | "CUSTOMER") {
  await setUserAccess({
    userId,
    role,
    permissions: null,
    roleExpiresAt: null,
    useRoleDefaults: true,
  });
}

export async function approveCancelRequest(orderId: string) {
  await requirePermission("orders", "edit");
  const order = await findOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.orderStatus !== "CANCEL_REQUESTED") {
    throw new Error("No cancel request pending");
  }

  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    const now = sqlNow();
    if (order.paymentStatus === "PAID") {
      for (const item of order.items) {
        await d1
          .prepare(`UPDATE Product SET stock = stock + ?, updatedAt = ? WHERE id = ?`)
          .bind(item.quantity, now, item.productId)
          .run();
        if (item.variantId) {
          await d1
            .prepare(`UPDATE ProductVariant SET stock = stock + ? WHERE id = ? AND productId = ?`)
            .bind(item.quantity, item.variantId, item.productId)
            .run();
        }
        await d1
          .prepare(
            `INSERT INTO StockLog (id, productId, change, note, createdAt) VALUES (?, ?, ?, ?, ?)`
          )
          .bind(
            cuidLike(),
            item.productId,
            item.quantity,
            `Cancel approved ${order.orderNumber}`,
            now
          )
          .run();
      }
      if (order.razorpayPaymentId) {
        try {
          const { createRefund } = await import("@/lib/razorpay");
          await createRefund(order.razorpayPaymentId, {
            notes: { orderId, orderNumber: order.orderNumber, reason: "cancel_approved" },
          });
        } catch (err) {
          console.error("[refund] cancel approve:", err);
          throw new Error(
            "Could not refund payment automatically. Retry refund from admin, then approve cancel."
          );
        }
      }
    }
    await d1
      .prepare(
        `UPDATE "Order" SET orderStatus = 'CANCELLED', paymentStatus = CASE WHEN paymentStatus = 'PAID' OR paymentStatus = 'REFUNDED' THEN 'REFUNDED' ELSE paymentStatus END, cancelRequestedAt = NULL, cancelReason = ?, previousOrderStatus = NULL, updatedAt = ? WHERE id = ?`
      )
      .bind(order.cancelReason, now, orderId)
      .run();
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    if (order.paymentStatus === "PAID" && order.razorpayPaymentId) {
      try {
        const { createRefund } = await import("@/lib/razorpay");
        await createRefund(order.razorpayPaymentId, {
          notes: { orderId, orderNumber: order.orderNumber, reason: "cancel_approved" },
        });
      } catch (err) {
        console.error("[refund] cancel approve:", err);
        throw new Error(
          "Could not refund payment automatically. Retry refund from admin, then approve cancel."
        );
      }
    }
    await prisma.$transaction(async (tx) => {
      if (order.paymentStatus === "PAID") {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
          if (item.variantId) {
            await tx.productVariant.updateMany({
              where: { id: item.variantId, productId: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
          await tx.stockLog.create({
            data: {
              productId: item.productId,
              change: item.quantity,
              note: `Cancel approved ${order.orderNumber}`,
            },
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          orderStatus: "CANCELLED",
          paymentStatus:
            order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED"
              ? "REFUNDED"
              : order.paymentStatus,
          cancelRequestedAt: null,
          cancelReason: order.cancelReason,
          previousOrderStatus: null,
        },
      });
    });
  }

  const full = await findOrderById(orderId);
  if (full) {
    void import("@/lib/email/orders")
      .then(({ notifyCancelApproved }) => notifyCancelApproved(full))
      .catch((err) => console.error("[email] cancel approved notify:", err));
  }

  void import("@/lib/logging/system-log").then(({ logSuccess }) =>
    logSuccess({
      category: "admin",
      action: "CANCEL_APPROVED",
      message: `Cancel approved for ${order.orderNumber}`,
      entityType: "Order",
      entityId: orderId,
      actorEmail: order.email,
    })
  );

  revalidatePath("/admin/orders");
  revalidatePath("/orders");
}

export async function rejectCancelRequest(orderId: string) {
  await requirePermission("orders", "edit");
  const order = await findOrderById(orderId);
  if (!order) throw new Error("Order not found");
  if (order.orderStatus !== "CANCEL_REQUESTED") {
    throw new Error("No cancel request pending");
  }

  const restoredStatus = order.previousOrderStatus || "PAID";
  const db = await getD1();
  if (db) {
    await asD1(db)
      .prepare(
        `UPDATE "Order" SET orderStatus = ?, cancelRequestedAt = NULL, cancelReason = NULL, previousOrderStatus = NULL, updatedAt = ? WHERE id = ?`
      )
      .bind(restoredStatus, sqlNow(), orderId)
      .run();
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: restoredStatus,
        cancelRequestedAt: null,
        cancelReason: null,
        previousOrderStatus: null,
      },
    });
  }

  const restored = await findOrderById(orderId);
  if (restored) {
    void import("@/lib/email/orders")
      .then(({ notifyCancelRejected }) => notifyCancelRejected(restored))
      .catch((err) => console.error("[email] cancel rejected notify:", err));
  }

  void import("@/lib/logging/system-log").then(({ logSuccess }) =>
    logSuccess({
      category: "admin",
      action: "CANCEL_REJECTED",
      message: `Cancel rejected for ${order.orderNumber}`,
      entityType: "Order",
      entityId: orderId,
      actorEmail: order.email,
      meta: { restoredStatus },
    })
  );

  revalidatePath("/admin/orders");
  revalidatePath("/orders");
}

export async function syncShipmentTracking(orderId: string) {
  await requirePermission("orders", "edit");
  const order = await findOrderById(orderId);
  if (!order?.shipment) throw new Error("No shipment for this order");

  const { trackShipment } = await import("@/lib/shiprocket");
  const track = await trackShipment({
    awb: order.shipment.awbCode,
    shipmentId: order.shipment.shipmentId,
    createdAt: order.createdAt,
    orderNumber: order.orderNumber,
  });

  const trackingStatus = track.status;
  const trackingUrl = track.trackingUrl || order.shipment.trackingUrl;
  const courierName = track.courierName || order.shipment.courierName;
  const awbCode = track.awb || order.shipment.awbCode;

  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    await d1
      .prepare(
        `UPDATE Shipment SET trackingStatus = ?, trackingUrl = ?, courierName = ?, awbCode = ? WHERE id = ?`
      )
      .bind(trackingStatus, trackingUrl, courierName, awbCode, order.shipment.id)
      .run();

    let nextStatus = order.orderStatus;
    if (
      track.mappedOrderStatus &&
      order.orderStatus !== "CANCELLED" &&
      order.orderStatus !== "CANCEL_REQUESTED"
    ) {
      await d1
        .prepare(`UPDATE "Order" SET orderStatus = ?, updatedAt = ? WHERE id = ?`)
        .bind(track.mappedOrderStatus, sqlNow(), orderId)
        .run();
      nextStatus = track.mappedOrderStatus;
    }

    const full = await findOrderById(orderId);
    if (full) {
      void import("@/lib/email/orders")
        .then(({ notifyTrackingUpdated }) =>
          notifyTrackingUpdated({ ...full, orderStatus: nextStatus })
        )
        .catch((err) => console.error("[email] tracking notify:", err));
    }
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.shipment.update({
      where: { id: order.shipment.id },
      data: {
        trackingStatus,
        trackingUrl,
        courierName,
        awbCode,
      },
    });

    let nextStatus = order.orderStatus;
    if (
      track.mappedOrderStatus &&
      order.orderStatus !== "CANCELLED" &&
      order.orderStatus !== "CANCEL_REQUESTED"
    ) {
      await prisma.order.update({
        where: { id: orderId },
        data: { orderStatus: track.mappedOrderStatus },
      });
      nextStatus = track.mappedOrderStatus;
    }

    const full = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, shipment: true },
    });
    if (full) {
      void import("@/lib/email/orders")
        .then(({ notifyTrackingUpdated }) =>
          notifyTrackingUpdated({ ...full, orderStatus: nextStatus })
        )
        .catch((err) => console.error("[email] tracking notify:", err));
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);
  return track;
}

export async function shipWithShiprocket(orderId: string): Promise<
  | {
      ok: true;
      shipmentId: string | null;
      awbCode: string | null;
      trackingUrl: string | null;
      orderStatus: string;
      warning?: string | null;
    }
  | { ok: false; error: string }
> {
  try {
    await requirePermission("orders", "edit");
    const { shipOrderWithShiprocket } = await import("@/lib/fulfillment-shiprocket");
    const result = await shipOrderWithShiprocket(orderId, { requireCredentials: true });
    revalidatePath("/admin/orders");
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/orders");
    return {
      ok: true,
      shipmentId: result.shipmentId,
      awbCode: result.awbCode,
      trackingUrl: result.trackingUrl,
      orderStatus: result.orderStatus,
      warning: result.warning ?? null,
    };
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Could not ship with Shiprocket";
    // Never throw — production digests Server Action errors into a generic RSC message
    return { ok: false, error: message };
  }
}
