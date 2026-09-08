"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/admin";
import { asD1, cuidLike, getD1, sqlNow } from "@/lib/db/d1";
import { listCategoriesDb, type CategoryRow } from "@/lib/db/categories";
import { slugify } from "@/lib/utils";

export type CategoryItem = CategoryRow;

export async function listCategories(): Promise<CategoryItem[]> {
  return listCategoriesDb();
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
  await requirePermission("categories", "edit");
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid category");

  const slug = slugify(parsed.data.name);
  const sortOrder = parsed.data.sortOrder ?? 0;
  const description = parsed.data.description || null;

  const db = await getD1();
  if (db) {
    const id = cuidLike();
    const now = sqlNow();
    try {
      await asD1(db)
        .prepare(
          `INSERT INTO Category (id, name, slug, description, sortOrder, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, parsed.data.name, slug, description, sortOrder, now, now)
        .run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique|UNIQUE/i.test(msg)) throw new Error("A category with this name already exists");
      throw new Error("Could not create category");
    }
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products/new");
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { id, slug };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  try {
    const created = await prisma.category.create({
      data: {
        name: parsed.data.name,
        slug,
        description,
        sortOrder,
      },
    });
    revalidatePath("/admin/categories");
    revalidatePath("/admin/products/new");
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { id: created.id, slug: created.slug };
  } catch {
    throw new Error("A category with this name already exists");
  }
}
