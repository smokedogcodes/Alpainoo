import type { Product } from "@prisma/client";
import { asD1, getD1 } from "@/lib/db/d1";
import {
  getProductByIdD1,
  getProductBySlugD1,
  listFacetsD1,
  listProductsD1,
  mapProduct,
  type ProductListOpts,
} from "@/lib/db/d1-products";

/**
 * Product reads that work on Cloudflare D1 (raw SQL) and locally (Prisma).
 */
export async function listProducts(opts: ProductListOpts = {}): Promise<Product[]> {
  const db = await getD1();
  if (db) return listProductsD1(db, opts);

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();

  const where: Record<string, unknown> = { isHidden: false };
  if (opts.category) where.category = opts.category;
  if (opts.brand) where.brand = opts.brand;
  if (opts.inStock) where.stock = { gt: 0 };
  if (opts.onSale) where.discount = { gt: 0 };
  if (opts.minPrice != null || opts.maxPrice != null) {
    where.sellingPrice = {
      ...(opts.minPrice != null ? { gte: opts.minPrice } : {}),
      ...(opts.maxPrice != null ? { lte: opts.maxPrice } : {}),
    };
  }
  if (opts.q) {
    where.OR = [
      { title: { contains: opts.q } },
      { brand: { contains: opts.q } },
      { category: { contains: opts.q } },
      { sku: { contains: opts.q } },
    ];
  }

  const orderBy = {
    [opts.orderBy || "reviewCount"]: opts.orderDir || "desc",
  } as Record<string, "asc" | "desc">;

  return prisma.product.findMany({
    where,
    orderBy,
    ...(opts.take != null ? { take: opts.take } : {}),
  });
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const db = await getD1();
  if (db) return getProductBySlugD1(db, slug);

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.product.findUnique({ where: { slug } });
}

export async function getProductById(id: string): Promise<Product | null> {
  const db = await getD1();
  if (db) return getProductByIdD1(db, id);

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.product.findUnique({ where: { id } });
}

export async function listProductFacets(): Promise<{
  brands: string[];
  categories: string[];
}> {
  const db = await getD1();
  if (db) return listFacetsD1(db);

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const [brands, categories] = await Promise.all([
    prisma.product.findMany({
      where: { isHidden: false },
      distinct: ["brand"],
      select: { brand: true },
    }),
    prisma.product.findMany({
      where: { isHidden: false },
      distinct: ["category"],
      select: { category: true },
    }),
  ]);
  return {
    brands: brands.map((b) => b.brand),
    categories: categories.map((c) => c.category),
  };
}

export async function searchProductsLite(q: string, take = 3) {
  const products = await listProducts({ q, take, orderBy: "reviewCount", orderDir: "desc" });
  return products.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    brand: p.brand,
    category: p.category,
    sellingPrice: p.sellingPrice,
    images: p.images,
  }));
}

/** Admin catalog including hidden products. */
export async function listAdminProducts(): Promise<Product[]> {
  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(`SELECT * FROM Product ORDER BY updatedAt DESC`)
      .all();
    return (res.results || []).map((r: Record<string, unknown>) => mapProduct(r));
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.product.findMany({ orderBy: { updatedAt: "desc" } });
}
