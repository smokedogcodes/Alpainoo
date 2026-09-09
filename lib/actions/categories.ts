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
    revalidateCategoryPaths();
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
    revalidateCategoryPaths();
    return { id: created.id, slug: created.slug };
  } catch {
    throw new Error("A category with this name already exists");
  }
}

const UpdateSchema = CreateSchema.extend({
  id: z.string().trim().min(1),
});

function revalidateCategoryPaths() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products/new");
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function updateCategory(input: {
  id: string;
  name: string;
  description?: string;
  sortOrder?: number;
}) {
  await requirePermission("categories", "edit");
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid category");

  const slug = slugify(parsed.data.name);
  const sortOrder = parsed.data.sortOrder ?? 0;
  const description = parsed.data.description || null;
  const now = sqlNow();

  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    const existing = await d1
      .prepare(`SELECT id FROM Category WHERE id = ? LIMIT 1`)
      .bind(parsed.data.id)
      .first();
    if (!existing) throw new Error("Category not found");

    try {
      await d1
        .prepare(
          `UPDATE Category SET name = ?, slug = ?, description = ?, sortOrder = ?, updatedAt = ? WHERE id = ?`
        )
        .bind(parsed.data.name, slug, description, sortOrder, now, parsed.data.id)
        .run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique|UNIQUE/i.test(msg)) throw new Error("A category with this name already exists");
      throw new Error("Could not update category");
    }
    revalidateCategoryPaths();
    return { id: parsed.data.id, slug };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  try {
    const updated = await prisma.category.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        slug,
        description,
        sortOrder,
      },
    });
    revalidateCategoryPaths();
    return { id: updated.id, slug: updated.slug };
  } catch {
    throw new Error("Could not update category (name may already exist)");
  }
}

export async function deleteCategory(id: string) {
  await requirePermission("categories", "delete");
  const categoryId = id.trim();
  if (!categoryId) throw new Error("Category id required");

  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    const existing = await d1
      .prepare(`SELECT id FROM Category WHERE id = ? LIMIT 1`)
      .bind(categoryId)
      .first();
    if (!existing) throw new Error("Category not found");

    // Detach products that reference this master id
    try {
      await d1
        .prepare(`UPDATE Product SET categoryId = NULL WHERE categoryId = ?`)
        .bind(categoryId)
        .run();
    } catch {
      /* older schemas may lack categoryId */
    }
    await d1.prepare(`DELETE FROM Category WHERE id = ?`).bind(categoryId).run();
    revalidateCategoryPaths();
    return;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  await prisma.product.updateMany({
    where: { categoryId },
    data: { categoryId: null },
  });
  await prisma.category.delete({ where: { id: categoryId } });
  revalidateCategoryPaths();
}

export async function updateCategoryAction(formData: FormData) {
  await updateCategory({
    id: String(formData.get("id") || ""),
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "") || undefined,
    sortOrder: formData.get("sortOrder") ? Number(formData.get("sortOrder")) : 0,
  });
}

export async function deleteCategoryAction(formData: FormData) {
  await deleteCategory(String(formData.get("id") || ""));
}
