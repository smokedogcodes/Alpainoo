"use server";

import { revalidatePath } from "next/cache";
import type { Product } from "@prisma/client";
import { auth } from "@/auth";
import { asD1, cuidLike, getD1, sqlNow, toBool, toDate } from "@/lib/db/d1";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Please sign in");
  return session.user.id;
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    description: String(row.description ?? ""),
    brand: String(row.brand),
    volume: row.volume != null ? String(row.volume) : null,
    mrp: Number(row.mrp),
    sellingPrice: Number(row.sellingPrice),
    discount: Number(row.discount ?? 0),
    sku: String(row.sku),
    stock: Number(row.stock ?? 0),
    category: String(row.category),
    benefits: String(row.benefits ?? "[]"),
    ingredients: row.ingredients != null ? String(row.ingredients) : null,
    usage: row.usage != null ? String(row.usage) : null,
    images: String(row.images ?? "[]"),
    rating: Number(row.rating ?? 4.5),
    reviewCount: Number(row.reviewCount ?? 0),
    isHidden: toBool(row.isHidden),
    metaTitle: row.metaTitle != null ? String(row.metaTitle) : null,
    metaDescription: row.metaDescription != null ? String(row.metaDescription) : null,
    lowStockThreshold: Number(row.lowStockThreshold ?? 5),
    categoryId: row.categoryId != null ? String(row.categoryId) : null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  } as Product;
}

export async function toggleWishlist(productId: string) {
  if (!productId) throw new Error("Invalid product");
  const userId = await requireUserId();

  const db = await getD1();
  if (db) {
    const existing = await asD1(db)
      .prepare(`SELECT id FROM WishlistItem WHERE userId = ? AND productId = ? LIMIT 1`)
      .bind(userId, productId)
      .first();
    if (existing) {
      await asD1(db)
        .prepare(`DELETE FROM WishlistItem WHERE userId = ? AND productId = ?`)
        .bind(userId, productId)
        .run();
      revalidatePath("/wishlist");
      return { wished: false };
    }
    await asD1(db)
      .prepare(
        `INSERT INTO WishlistItem (id, userId, productId, createdAt) VALUES (?, ?, ?, ?)`
      )
      .bind(cuidLike(), userId, productId, sqlNow())
      .run();
    revalidatePath("/wishlist");
    return { wished: true };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/wishlist");
    return { wished: false };
  }
  await prisma.wishlistItem.create({ data: { userId, productId } });
  revalidatePath("/wishlist");
  return { wished: true };
}

export async function listWishlist(userId?: string): Promise<Product[]> {
  const uid = userId || (await requireUserId());

  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(
        `SELECT p.* FROM WishlistItem w
         JOIN Product p ON p.id = w.productId
         WHERE w.userId = ?
         ORDER BY w.createdAt DESC`
      )
      .bind(uid)
      .all();
    return (res.results || []).map((r: Record<string, unknown>) => mapProduct(r));
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const rows = await prisma.wishlistItem.findMany({
    where: { userId: uid },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => r.product);
}

export async function isInWishlist(productId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id || !productId) return false;
  const userId = session.user.id;

  const db = await getD1();
  if (db) {
    const row = await asD1(db)
      .prepare(`SELECT id FROM WishlistItem WHERE userId = ? AND productId = ? LIMIT 1`)
      .bind(userId, productId)
      .first();
    return Boolean(row);
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const row = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  return Boolean(row);
}
