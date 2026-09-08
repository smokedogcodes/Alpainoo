"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/admin";
import { asD1, cuidLike, getD1 } from "@/lib/db/d1";
import {
  listVariantsForProduct,
  type VariantItem,
} from "@/lib/db/variants";

export type { VariantItem };

export async function listVariants(productId: string): Promise<VariantItem[]> {
  await requirePermission("products", "view");
  return listVariantsForProduct(productId);
}

/** Storefront-safe variant list (no admin required). */
export async function listPublicVariants(productId: string): Promise<VariantItem[]> {
  return listVariantsForProduct(productId);
}

const AddSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().min(1).max(64),
  scent: z.string().trim().max(100).optional(),
  size: z.string().trim().max(50).optional(),
  mrp: z.number().positive().max(1_000_000).optional(),
  sellingPrice: z.number().positive().max(1_000_000).optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
});

export async function addVariant(input: {
  productId: string;
  name: string;
  sku: string;
  scent?: string;
  size?: string;
  mrp?: number;
  sellingPrice?: number;
  stock?: number;
}) {
  await requirePermission("products", "edit");
  const parsed = AddSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid variant");

  const stock = parsed.data.stock ?? 0;
  const scent = parsed.data.scent || null;
  const size = parsed.data.size || null;
  const mrp = parsed.data.mrp ?? null;
  const sellingPrice = parsed.data.sellingPrice ?? null;

  const db = await getD1();
  if (db) {
    const id = cuidLike();
    try {
      await asD1(db)
        .prepare(
          `INSERT INTO ProductVariant (id, productId, name, sku, scent, size, mrp, sellingPrice, stock)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          parsed.data.productId,
          parsed.data.name,
          parsed.data.sku,
          scent,
          size,
          mrp,
          sellingPrice,
          stock
        )
        .run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique|UNIQUE/i.test(msg)) throw new Error("A variant with this SKU already exists");
      throw new Error("Could not add variant");
    }
    revalidatePath(`/admin/products/${parsed.data.productId}`);
    return { id };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  try {
    const created = await prisma.productVariant.create({
      data: {
        productId: parsed.data.productId,
        name: parsed.data.name,
        sku: parsed.data.sku,
        scent,
        size,
        mrp,
        sellingPrice,
        stock,
      },
    });
    revalidatePath(`/admin/products/${parsed.data.productId}`);
    return { id: created.id };
  } catch {
    throw new Error("A variant with this SKU already exists");
  }
}

export async function deleteVariant(id: string, productId: string) {
  await requirePermission("products", "delete");
  if (!id) throw new Error("Invalid variant");

  const db = await getD1();
  if (db) {
    await asD1(db).prepare(`DELETE FROM ProductVariant WHERE id = ?`).bind(id).run();
    if (productId) revalidatePath(`/admin/products/${productId}`);
    return { ok: true as const };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  await prisma.productVariant.delete({ where: { id } });
  if (productId) revalidatePath(`/admin/products/${productId}`);
  return { ok: true as const };
}
