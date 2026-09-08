"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/admin";
import { asD1, cuidLike, getD1, sqlNow, toDate } from "@/lib/db/d1";
import { slugify } from "@/lib/utils";

export type CollectionItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapCollection(row: Record<string, unknown>): CollectionItem {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description != null ? String(row.description) : null,
    coverImage: row.coverImage != null ? String(row.coverImage) : null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export async function listCollections(): Promise<CollectionItem[]> {
  return listPublicCollections();
}

export async function listPublicCollections(): Promise<CollectionItem[]> {
  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(`SELECT * FROM Collection ORDER BY name ASC`)
      .all();
    return (res.results || []).map((r: Record<string, unknown>) => mapCollection(r));
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.collection.findMany({ orderBy: { name: "asc" } });
}

export async function getCollectionBySlug(slug: string) {
  const db = await getD1();
  if (db) {
    const row = await asD1(db)
      .prepare(`SELECT * FROM Collection WHERE slug = ? LIMIT 1`)
      .bind(slug)
      .first();
    if (!row) return null;
    const collection = mapCollection(row as Record<string, unknown>);
    const links = await asD1(db)
      .prepare(`SELECT productId FROM CollectionProduct WHERE collectionId = ?`)
      .bind(collection.id)
      .all();
    const productIds = ((links.results || []) as { productId: string }[]).map((r) =>
      String(r.productId)
    );
    return { collection, productIds };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const collection = await prisma.collection.findUnique({
    where: { slug },
    include: { products: true },
  });
  if (!collection) return null;
  return {
    collection: {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      coverImage: collection.coverImage,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    },
    productIds: collection.products.map((p) => p.productId),
  };
}

export async function setCollectionProducts(collectionId: string, productIds: string[]) {
  await requirePermission("collections", "edit");
  const unique = Array.from(new Set(productIds.map((id) => id.trim()).filter(Boolean)));

  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    await d1.prepare(`DELETE FROM CollectionProduct WHERE collectionId = ?`).bind(collectionId).run();
    for (const productId of unique) {
      await d1
        .prepare(
          `INSERT INTO CollectionProduct (id, collectionId, productId) VALUES (?, ?, ?)`
        )
        .bind(cuidLike(), collectionId, productId)
        .run();
    }
    revalidatePath("/admin/collections");
    revalidatePath("/collections");
    return;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  await prisma.collectionProduct.deleteMany({ where: { collectionId } });
  if (unique.length) {
    await prisma.collectionProduct.createMany({
      data: unique.map((productId) => ({ collectionId, productId })),
    });
  }
  revalidatePath("/admin/collections");
  revalidatePath("/collections");
}

export async function setCollectionProductsAction(formData: FormData) {
  const collectionId = String(formData.get("collectionId") || "");
  const productIds = formData
    .getAll("productIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  await setCollectionProducts(collectionId, productIds);
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  coverImage: z.string().trim().max(500).optional(),
});

export async function createCollection(input: {
  name: string;
  description?: string;
  coverImage?: string;
}) {
  await requirePermission("collections", "edit");
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid collection");

  const slug = slugify(parsed.data.name);
  const description = parsed.data.description || null;
  const coverImage = parsed.data.coverImage || null;

  const db = await getD1();
  if (db) {
    const id = cuidLike();
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `INSERT INTO Collection (id, name, slug, description, coverImage, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, parsed.data.name, slug, description, coverImage, now, now)
      .run();
    revalidatePath("/admin/collections");
    revalidatePath("/collections");
    return { id, slug };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const created = await prisma.collection.create({
    data: {
      name: parsed.data.name,
      slug,
      description,
      coverImage,
    },
  });
  revalidatePath("/admin/collections");
  revalidatePath("/collections");
  return { id: created.id, slug: created.slug };
}

export async function createCollectionAction(formData: FormData) {
  await createCollection({
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "") || undefined,
    coverImage: String(formData.get("coverImage") || "") || undefined,
  });
}
