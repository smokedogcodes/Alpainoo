"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function upsertProduct(formData: FormData) {
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "");
  const brand = String(formData.get("brand") || "");
  const category = String(formData.get("category") || "");
  const description = String(formData.get("description") || "");
  const volume = String(formData.get("volume") || "");
  const mrp = Number(formData.get("mrp") || 0);
  const sellingPrice = Number(formData.get("sellingPrice") || 0);
  const stock = Number(formData.get("stock") || 0);
  const sku = String(formData.get("sku") || "");
  const ingredients = String(formData.get("ingredients") || "");
  const usage = String(formData.get("usage") || "");
  const benefits = String(formData.get("benefits") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const images = String(formData.get("images") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const discount = mrp > 0 ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;
  const slug = slugify(title);

  const data = {
    title,
    slug,
    brand,
    category,
    description,
    volume,
    mrp,
    sellingPrice,
    discount,
    stock,
    sku,
    ingredients,
    usage,
    benefits: JSON.stringify(benefits),
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
          note: String(formData.get("stockNote") || "Manual stock update"),
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
  await prisma.product.update({ where: { id }, data: { isHidden } });
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function deleteProduct(id: string) {
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
  await prisma.order.update({ where: { id }, data: { orderStatus } });
  revalidatePath("/admin/orders");
}

export async function upsertBlog(formData: FormData) {
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "");
  const excerpt = String(formData.get("excerpt") || "");
  const content = String(formData.get("content") || "");
  const published = formData.get("published") === "on";
  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const slug = slugify(title);
  const data = {
    title,
    slug,
    excerpt,
    content,
    published,
    tags: JSON.stringify(tags),
    coverImage: String(formData.get("coverImage") || "") || null,
  };
  if (id) await prisma.blogPost.update({ where: { id }, data });
  else await prisma.blogPost.create({ data });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}

export async function deleteBlog(id: string) {
  await prisma.blogPost.delete({ where: { id } });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}
