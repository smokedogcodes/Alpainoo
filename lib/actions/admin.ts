"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth/admin";
import { OrderStatusSchema, sanitizeBlogHtml, sanitizeImageUrl } from "@/lib/validation";

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
  };

  const parsed = ProductFormSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid product");

  const { id, mrp, sellingPrice, stock, title, images, stockNote, ...rest } = parsed.data;
  if (sellingPrice > mrp) throw new Error("Selling price cannot exceed MRP");

  const discount = mrp > 0 ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;
  const slug = slugify(title);

  const data = {
    ...rest,
    title,
    slug,
    mrp,
    sellingPrice,
    discount,
    stock,
    benefits: JSON.stringify(rest.benefits),
    images: JSON.stringify(images.length ? images : ["/products/placeholder.jpg"]),
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
    await prisma.stockLog.create({
      data: { productId: created.id, change: stock, note: "Initial stock" },
    });
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function toggleHideProduct(id: string, isHidden: boolean) {
  await requireAdmin();
  if (!id || typeof isHidden !== "boolean") throw new Error("Invalid input");
  await prisma.product.update({ where: { id }, data: { isHidden } });
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  if (!id) throw new Error("Invalid product");
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
  await prisma.order.update({ where: { id }, data: { orderStatus: status } });
  revalidatePath("/admin/orders");
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
  const data = {
    title,
    slug,
    excerpt,
    content,
    published,
    tags: JSON.stringify(tags),
    coverImage,
  };
  if (id) await prisma.blogPost.update({ where: { id }, data });
  else await prisma.blogPost.create({ data });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}

export async function deleteBlog(id: string) {
  await requireAdmin();
  if (!id) throw new Error("Invalid blog");
  await prisma.blogPost.delete({ where: { id } });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}

export async function setUserRole(userId: string, role: "ADMIN" | "CUSTOMER") {
  await requireAdmin();
  if (!userId || (role !== "ADMIN" && role !== "CUSTOMER")) {
    throw new Error("Invalid input");
  }

  if (role === "CUSTOMER") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (target?.role === "ADMIN" && admins <= 1) {
      throw new Error("Cannot remove the last admin");
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}

export async function approveCancelRequest(orderId: string) {
  await requireAdmin();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.orderStatus !== "CANCEL_REQUESTED") {
    throw new Error("No cancel request pending");
  }

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

  revalidatePath("/admin/orders");
  revalidatePath("/orders");
}

export async function rejectCancelRequest(orderId: string) {
  await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
  if (order.orderStatus !== "CANCEL_REQUESTED") {
    throw new Error("No cancel request pending");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      orderStatus: order.previousOrderStatus || "PAID",
      cancelRequestedAt: null,
      cancelReason: null,
      previousOrderStatus: null,
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath("/orders");
}

export async function syncShipmentTracking(orderId: string) {
  await requireAdmin();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shipment: true },
  });
  if (!order?.shipment) throw new Error("No shipment for this order");

  const { trackShipment } = await import("@/lib/shiprocket");
  const track = await trackShipment({
    awb: order.shipment.awbCode,
    shipmentId: order.shipment.shipmentId,
    createdAt: order.createdAt,
    orderNumber: order.orderNumber,
  });

  await prisma.shipment.update({
    where: { id: order.shipment.id },
    data: {
      trackingStatus: track.status,
      trackingUrl: track.trackingUrl || order.shipment.trackingUrl,
      courierName: track.courierName || order.shipment.courierName,
      awbCode: track.awb || order.shipment.awbCode,
    },
  });

  if (track.mappedOrderStatus && order.orderStatus !== "CANCELLED" && order.orderStatus !== "CANCEL_REQUESTED") {
    await prisma.order.update({
      where: { id: orderId },
      data: { orderStatus: track.mappedOrderStatus },
    });
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);
  return track;
}
