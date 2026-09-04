"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/auth/admin";
import { asD1, cuidLike, getD1, sqlNow, toBool, toDate } from "@/lib/db/d1";

const SubmitSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  author: z.string().trim().min(1).max(100),
  title: z.string().trim().max(200).optional(),
  body: z.string().trim().min(3).max(5000),
});

export type ReviewListItem = {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string | null;
  body: string;
  approved: boolean;
  createdAt: Date;
};

function mapReview(row: Record<string, unknown>): ReviewListItem {
  return {
    id: String(row.id),
    productId: String(row.productId),
    author: String(row.author),
    rating: Number(row.rating),
    title: row.title != null ? String(row.title) : null,
    body: String(row.body),
    approved: toBool(row.approved),
    createdAt: toDate(row.createdAt),
  };
}

export async function submitReview(input: {
  productId: string;
  rating: number;
  author: string;
  title?: string;
  body: string;
}) {
  const parsed = SubmitSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid review");

  const session = await auth();
  const userId = session?.user?.id || null;
  const author =
    parsed.data.author ||
    session?.user?.name ||
    session?.user?.email?.split("@")[0] ||
    "Guest";

  const db = await getD1();
  if (db) {
    const id = cuidLike();
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `INSERT INTO Review (id, productId, userId, author, rating, title, body, approved, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .bind(
        id,
        parsed.data.productId,
        userId,
        author,
        parsed.data.rating,
        parsed.data.title || null,
        parsed.data.body,
        now,
        now
      )
      .run();
    return { id, approved: false };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const review = await prisma.review.create({
    data: {
      productId: parsed.data.productId,
      userId,
      author,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body,
      approved: false,
    },
  });
  return { id: review.id, approved: false };
}

export async function listApprovedReviews(productId: string): Promise<ReviewListItem[]> {
  if (!productId) return [];

  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(
        `SELECT * FROM Review WHERE productId = ? AND approved = 1 ORDER BY createdAt DESC`
      )
      .bind(productId)
      .all();
    return (res.results || []).map((r: Record<string, unknown>) => mapReview(r));
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const rows = await prisma.review.findMany({
    where: { productId, approved: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    author: r.author,
    rating: r.rating,
    title: r.title,
    body: r.body,
    approved: r.approved,
    createdAt: r.createdAt,
  }));
}

export async function listPendingReviews(take = 50): Promise<ReviewListItem[]> {
  await requireAdmin();

  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(`SELECT * FROM Review WHERE approved = 0 ORDER BY createdAt DESC LIMIT ?`)
      .bind(take)
      .all();
    return (res.results || []).map((r: Record<string, unknown>) => mapReview(r));
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const rows = await prisma.review.findMany({
    where: { approved: false },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    author: r.author,
    rating: r.rating,
    title: r.title,
    body: r.body,
    approved: r.approved,
    createdAt: r.createdAt,
  }));
}

async function refreshProductRating(productId: string) {
  const db = await getD1();
  if (db) {
    const agg = await asD1(db)
      .prepare(
        `SELECT AVG(rating) as avgRating, COUNT(*) as cnt FROM Review WHERE productId = ? AND approved = 1`
      )
      .bind(productId)
      .first();
    const avg = Number(agg?.avgRating ?? 0);
    const cnt = Number(agg?.cnt ?? 0);
    const now = sqlNow();
    await asD1(db)
      .prepare(`UPDATE Product SET rating = ?, reviewCount = ?, updatedAt = ? WHERE id = ?`)
      .bind(avg || 0, cnt, now, productId)
      .run();
    return;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const approved = await prisma.review.findMany({
    where: { productId, approved: true },
    select: { rating: true },
  });
  const reviewCount = approved.length;
  const rating =
    reviewCount > 0 ? approved.reduce((s, r) => s + r.rating, 0) / reviewCount : 0;
  await prisma.product.update({
    where: { id: productId },
    data: { rating, reviewCount },
  });
}

export async function approveReview(id: string) {
  await requireAdmin();
  if (!id) throw new Error("Invalid review");

  const db = await getD1();
  if (db) {
    const row = await asD1(db)
      .prepare(`SELECT id, productId, approved FROM Review WHERE id = ? LIMIT 1`)
      .bind(id)
      .first();
    if (!row) throw new Error("Review not found");
    const productId = String(row.productId);
    const now = sqlNow();
    await asD1(db)
      .prepare(`UPDATE Review SET approved = 1, updatedAt = ? WHERE id = ?`)
      .bind(now, id)
      .run();
    await refreshProductRating(productId);
    revalidatePath("/admin/reviews");
    revalidatePath("/products");
    return { ok: true as const };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw new Error("Review not found");
  if (!review.approved) {
    await prisma.review.update({ where: { id }, data: { approved: true } });
    await refreshProductRating(review.productId);
  }
  revalidatePath("/admin/reviews");
  revalidatePath("/products");
  revalidatePath(`/admin/products/${review.productId}`);
  return { ok: true as const };
}
