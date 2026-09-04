"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { asD1, cuidLike, getD1, sqlNow, toDate } from "@/lib/db/d1";
import { slugify } from "@/lib/utils";

export type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

function mapCategory(row: Record<string, unknown>): CategoryItem {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description != null ? String(row.description) : null,
    sortOrder: Number(row.sortOrder ?? 0),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export async function listCategories(): Promise<CategoryItem[]> {
  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(`SELECT * FROM Category ORDER BY sortOrder ASC, name ASC`)
      .all();
    return (res.results || []).map((r: Record<string, unknown>) => mapCategory(r));
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export async function createCategory(input: {
  name: string;
  description?: string;
  sortOrder?: number;
}) {
  await requireAdmin();
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid category");

  const slug = slugify(parsed.data.name);
  const sortOrder = parsed.data.sortOrder ?? 0;
  const description = parsed.data.description || null;

  const db = await getD1();
  if (db) {
    const id = cuidLike();
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `INSERT INTO Category (id, name, slug, description, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, parsed.data.name, slug, description, sortOrder, now, now)
      .run();
    revalidatePath("/admin/categories");
    revalidatePath("/products");
    return { id, slug };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const created = await prisma.category.create({
    data: {
      name: parsed.data.name,
      slug,
      description,
      sortOrder,
    },
  });
  revalidatePath("/admin/categories");
  revalidatePath("/products");
  return { id: created.id, slug: created.slug };
}
