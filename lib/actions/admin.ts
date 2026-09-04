"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth/admin";
import { OrderStatusSchema, sanitizeImageUrl } from "@/lib/validation";
import { sanitizeBlogHtml } from "@/lib/sanitize-html";
import { asD1, cuidLike, getD1, sqlNow } from "@/lib/db/d1";
import { findOrderById } from "@/lib/db/orders";
import { findUserById, updateUserRole } from "@/lib/db/users";
import { deleteBlogPost, upsertBlogPost } from "@/lib/db/blog";

const ProductFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2).max(200),
  brand: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(10000),
  volume: z.string().trim().max(50).optional(),
  mrp: z.number().positive().max(1_000_000),
  sellingPrice: z.number().positive().max(1_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  sku: z.string().trim().min(1).max(64),
  ingredients: z.string().max(5000).optional(),
  usage: z.string().max(5000).optional(),
  benefits: z.array(z.string().max(200)).max(50),
  images: z.array(z.string().max(500)).max(20),
  stockNote: z.string().max(200).optional(),
  metaTitle: z.string().trim().max(120).optional(),
  metaDescription: z.string().trim().max(320).optional(),
  lowStockThreshold: z.number().int().min(0).max(10_000).optional(),
});

export async function upsertProduct(formData: FormData) {
  await requireAdmin();

  const raw = {
    id: String(formData.get("id") || "") || undefined,
    title: String(formData.get("title") || ""),
    brand: String(formData.get("brand") || ""),
    category: String(formData.get("category") || ""),
    description: String(formData.get("description") || ""),
    volume: String(formData.get("volume") || ""),
    mrp: Number(formData.get("mrp") || 0),
    sellingPrice: Number(formData.get("sellingPrice") || 0),
    stock: Number(formData.get("stock") || 0),
    sku: String(formData.get("sku") || ""),
    ingredients: String(formData.get("ingredients") || ""),
    usage: String(formData.get("usage") || ""),
    benefits: String(formData.get("benefits") || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    images: String(formData.get("images") || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(sanitizeImageUrl)
      .filter(Boolean),
    stockNote: String(formData.get("stockNote") || "") || undefined,
    metaTitle: String(formData.get("metaTitle") || "").trim() || undefined,
    metaDescription: String(formData.get("metaDescription") || "").trim() || undefined,
    lowStockThreshold: formData.get("lowStockThreshold")
      ? Number(formData.get("lowStockThreshold"))
      : undefined,
  };

  const parsed = ProductFormSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid product");

  const {
    id,
    mrp,
    sellingPrice,
    stock,
    title,
    images,
    stockNote,
    metaTitle,
    metaDescription,
    lowStockThreshold,
    ...rest
  } = parsed.data;
  if (sellingPrice > mrp) throw new Error("Selling price cannot exceed MRP");

  const discount = mrp > 0 ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;
  const slug = slugify(title);
  const benefitsJson = JSON.stringify(rest.benefits);
  const imagesJson = JSON.stringify(images.length ? images : ["/products/placeholder.jpg"]);
  const metaTitleVal = metaTitle || null;
  const metaDescriptionVal = metaDescription || null;
  const threshold = lowStockThreshold ?? 5;
  const volume = rest.volume || null;
  const ingredients = rest.ingredients || null;
  const usage = rest.usage || null;

  let productId = id;

  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    const now = sqlNow();
    if (id) {
      const prev = await d1
        .prepare(`SELECT stock FROM Product WHERE id = ? LIMIT 1`)
        .bind(id)
        .first();
      if (!prev) throw new Error("Product not found");
      const prevStock = Number((prev as { stock: number }).stock);
      await d1
        .prepare(
          `UPDATE Product SET title = ?, slug = ?, description = ?, brand = ?, volume = ?, mrp = ?, sellingPrice = ?,
           discount = ?, sku = ?, stock = ?, category = ?, benefits = ?, ingredients = ?, usage = ?, images = ?,
           metaTitle = ?, metaDescription = ?, lowStockThreshold = ?, updatedAt = ?
           WHERE id = ?`
        )
        .bind(
          title,
          slug,
          rest.description,
          rest.brand,
          volume,
          mrp,
          sellingPrice,
          discount,
          rest.sku,
          stock,
          rest.category,
          benefitsJson,
          ingredients,
          usage,
          imagesJson,
          metaTitleVal,
          metaDescriptionVal,
          threshold,
          now,
          id
        )
        .run();
      if (prevStock !== stock) {
        await d1
          .prepare(
            `INSERT INTO StockLog (id, productId, change, note, createdAt) VALUES (?, ?, ?, ?, ?)`
          )
          .bind(cuidLike(), id, stock - prevStock, stockNote || "Manual stock update", now)
          .run();
      }
    } else {
      productId = cuidLike();
      await d1
        .prepare(
          `INSERT INTO Product (id, title, slug, description, brand, volume, mrp, sellingPrice, discount, sku, stock,
           category, benefits, ingredients, usage, images, rating, reviewCount, isHidden, metaTitle, metaDescription,
           lowStockThreshold, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4.5, 0, 0, ?, ?, ?, ?, ?)`
        )
        .bind(
          productId,
          title,
          slug,
          rest.description,
          rest.brand,
          volume,
          mrp,
          sellingPrice,
          discount,
          rest.sku,
          stock,
          rest.category,
          benefitsJson,
          ingredients,
          usage,
          imagesJson,
          metaTitleVal,
          metaDescriptionVal,
          threshold,
          now,
          now
        )
        .run();
      await d1
        .prepare(
          `INSERT INTO StockLog (id, productId, change, note, createdAt) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(cuidLike(), productId, stock, "Initial stock", now)
        .run();
    }
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const data = {
      ...rest,
      title,
      slug,
      mrp,
      sellingPrice,
      discount,
      stock,
      benefits: benefitsJson,
      images: imagesJson,
      metaTitle: metaTitleVal,
      metaDescription: metaDescriptionVal,
      ...(lowStockThreshold != null ? { lowStockThreshold } : {}),
    };

    if (id) {
      const prev = await prisma.product.findUnique({ where: { id } });
      await prisma.product.update({ where: { id }, data });
      if (prev && prev.stock !== stock) {
        await prisma.stockLog.create({
          data: {
            productId: id,
            change: stock - prev.stock,
            note: stockNote || "Manual stock update",
          },
        });
      }
    } else {
      const created = await prisma.product.create({ data });
      productId = created.id;
      await prisma.stockLog.create({
        data: { productId: created.id, change: stock, note: "Initial stock" },
      });
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");

  void import("@/lib/logging/system-log").then(({ logSuccess }) =>
    logSuccess({
      category: "admin",
      action: id ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
      message: id ? `Product updated: ${title}` : `Product created: ${title}`,
      entityType: "Product",
      entityId: productId,
      meta: { sku: rest.sku, stock },
    })
  );
  void import("@/lib/logging/db-audit").then(({ writeDbAudit }) =>
    writeDbAudit({
      tableName: "Product",
      operation: id ? "UPDATE" : "INSERT",
      rowId: productId,
      newData: { id: productId, title, stock, sku: rest.sku },
    })
  );
}

export async function toggleHideProduct(id: string, isHidden: boolean) {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();

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
  await requireAdmin();
  if (!id) throw new Error("Invalid blog");
  await deleteBlogPost(id);
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}

export async function setUserRole(userId: string, role: "ADMIN" | "CUSTOMER") {
  await requireAdmin();
  if (!userId || (role !== "ADMIN" && role !== "CUSTOMER")) {
    throw new Error("Invalid input");
  }

  if (role === "CUSTOMER") {
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

  await updateUserRole(userId, role);

  void import("@/lib/logging/system-log").then(({ logSuccess }) =>
    logSuccess({
      category: "admin",
      action: "USER_ROLE_CHANGED",
      message: `User role set to ${role}`,
      entityType: "User",
      entityId: userId,
      meta: { role },
    })
  );

  revalidatePath("/admin/users");
}

export async function approveCancelRequest(orderId: string) {
  await requireAdmin();
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
    }
    await d1
      .prepare(
        `UPDATE "Order" SET orderStatus = 'CANCELLED', cancelRequestedAt = NULL, cancelReason = ?, previousOrderStatus = NULL, updatedAt = ? WHERE id = ?`
      )
      .bind(order.cancelReason, now, orderId)
      .run();
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.$transaction(async (tx) => {
      if (order.paymentStatus === "PAID") {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
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
  await requireAdmin();
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
  await requireAdmin();
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
