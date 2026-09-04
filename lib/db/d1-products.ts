import type { Product } from "@prisma/client";
import { asD1, getD1, toBool, toDate } from "@/lib/db/d1";

export { getD1 };

export function mapProduct(row: Record<string, unknown>): Product {
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
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.reviewCount ?? 0),
    isHidden: toBool(row.isHidden),
    metaTitle: row.metaTitle != null ? String(row.metaTitle) : null,
    metaDescription:
      row.metaDescription != null ? String(row.metaDescription) : null,
    lowStockThreshold: Number(row.lowStockThreshold ?? 5),
    categoryId: row.categoryId != null ? String(row.categoryId) : null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  } as Product;
}

export type ProductListOpts = {
  take?: number;
  orderBy?: "reviewCount" | "createdAt" | "sellingPrice" | "discount";
  orderDir?: "asc" | "desc";
  category?: string;
  brand?: string;
  q?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
};

export async function listProductsD1(
  db: D1Database,
  opts: ProductListOpts = {}
): Promise<Product[]> {
  const d1 = asD1(db);
  const where: string[] = ["isHidden = 0"];
  const binds: unknown[] = [];

  if (opts.category) {
    where.push("category = ?");
    binds.push(opts.category);
  }
  if (opts.brand) {
    where.push("brand = ?");
    binds.push(opts.brand);
  }
  if (opts.inStock) where.push("stock > 0");
  if (opts.onSale) where.push("discount > 0");
  if (opts.minPrice != null) {
    where.push("sellingPrice >= ?");
    binds.push(opts.minPrice);
  }
  if (opts.maxPrice != null) {
    where.push("sellingPrice <= ?");
    binds.push(opts.maxPrice);
  }
  if (opts.q) {
    where.push(
      "(title LIKE ? OR brand LIKE ? OR category LIKE ? OR sku LIKE ?)"
    );
    const like = `%${opts.q}%`;
    binds.push(like, like, like, like);
  }

  const col = opts.orderBy || "reviewCount";
  const dir = (opts.orderDir || "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";
  const limit = opts.take != null ? `LIMIT ${Number(opts.take)}` : "";

  const sql = `SELECT * FROM Product WHERE ${where.join(" AND ")} ORDER BY ${col} ${dir} ${limit}`;
  const result = await d1.prepare(sql).bind(...binds).all();
  return (result.results || []).map((r: Record<string, unknown>) =>
    mapProduct(r)
  );
}

export async function getProductBySlugD1(
  db: D1Database,
  slug: string
): Promise<Product | null> {
  const row = await asD1(db)
    .prepare("SELECT * FROM Product WHERE slug = ? LIMIT 1")
    .bind(slug)
    .first();
  return row ? mapProduct(row as Record<string, unknown>) : null;
}

export async function getProductByIdD1(
  db: D1Database,
  id: string
): Promise<Product | null> {
  const row = await asD1(db)
    .prepare("SELECT * FROM Product WHERE id = ? LIMIT 1")
    .bind(id)
    .first();
  return row ? mapProduct(row as Record<string, unknown>) : null;
}

export async function listFacetsD1(
  db: D1Database
): Promise<{ brands: string[]; categories: string[] }> {
  const d1 = asD1(db);
  const [brandsRes, catsRes] = await Promise.all([
    d1
      .prepare(
        "SELECT DISTINCT brand FROM Product WHERE isHidden = 0 ORDER BY brand"
      )
      .all(),
    d1
      .prepare(
        "SELECT DISTINCT category FROM Product WHERE isHidden = 0 ORDER BY category"
      )
      .all(),
  ]);
  return {
    brands: (brandsRes.results || []).map((r: { brand: string }) => r.brand),
    categories: (catsRes.results || []).map(
      (r: { category: string }) => r.category
    ),
  };
}
