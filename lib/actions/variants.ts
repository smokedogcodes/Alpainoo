"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { asD1, cuidLike, getD1, sqlNow } from "@/lib/db/d1";

export type VariantItem = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  scent: string | null;
  size: string | null;
  mrp: number | null;
  sellingPrice: number | null;
  stock: number;
};

function mapVariant(row: Record<string, unknown>): VariantItem {
  return {
    id: String(row.id),
    productId: String(row.productId),
    name: String(row.name),
    sku: String(row.sku),
    scent: row.scent != null ? String(row.scent) : null,
    size: row.size != null ? String(row.size) : null,
    mrp: row.mrp != null ? Number(row.mrp) : null,
    sellingPrice: row.sellingPrice != null ? Number(row.sellingPrice) : null,
    stock: Number(row.stock ?? 0),
  };
}

export async function listVariants(productId: string): Promise<VariantItem[]> {
  await requireAdmin();
  if (!productId) return [];

  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(`SELECT * FROM ProductVariant WHERE productId = ? ORDER BY name ASC`)
      .bind(productId)
      .all();
    return (res.results || []).map((r: Record<string, unknown>) => mapVariant(r));
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const rows = await prisma.productVariant.findMany({
    where: { productId },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    name: r.name,
    sku: r.sku,
    scent: r.scent,
    size: r.size,
    mrp: r.mrp,
    sellingPrice: r.sellingPrice,
    stock: r.stock,
  }));
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
  await requireAdmin();
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
    revalidatePath(`/admin/products/${parsed.data.productId}`);
    return { id };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
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
}

export async function deleteVariant(id: string, productId: string) {
  await requireAdmin();
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
