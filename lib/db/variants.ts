import { asD1, getD1 } from "@/lib/db/d1";

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

/** Plain DB read — safe to call from Server Components (not a server action). */
export async function listVariantsForProduct(productId: string): Promise<VariantItem[]> {
  if (!productId) return [];

  const db = await getD1();
  if (db) {
    try {
      const res = await asD1(db)
        .prepare(`SELECT * FROM ProductVariant WHERE productId = ? ORDER BY name ASC`)
        .bind(productId)
        .all();
      return (res.results || []).map((r: Record<string, unknown>) => mapVariant(r));
    } catch (err) {
      console.error("[variants] list failed:", err);
      return [];
    }
  }

  try {
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
  } catch (err) {
    console.error("[variants] prisma list failed:", err);
    return [];
  }
}
