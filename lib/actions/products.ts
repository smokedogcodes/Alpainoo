"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { requirePermission } from "@/lib/auth/admin";
import { sanitizeImageUrl } from "@/lib/validation";
import { asD1, cuidLike, getD1, sqlNow } from "@/lib/db/d1";

const ProductFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2).max(200),
  brand: z.string().trim().max(100).optional(),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().max(10000).optional(),
  volume: z.string().trim().max(50).optional(),
  mrp: z.number().positive().max(1_000_000),
  sellingPrice: z.number().positive().max(1_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  sku: z.string().trim().max(64).optional(),
  ingredients: z.string().max(5000).optional(),
  usage: z.string().max(5000).optional(),
  benefits: z.array(z.string().max(200)).max(50),
  images: z.array(z.string().max(500)).max(20),
  stockNote: z.string().max(200).optional(),
  metaTitle: z.string().trim().max(120).optional(),
  metaDescription: z.string().trim().max(320).optional(),
  lowStockThreshold: z.number().int().min(0).max(10_000).optional(),
});

export type UpsertProductInput = {
  id?: string;
  title: string;
  brand?: string;
  category: string;
  description?: string;
  volume?: string;
  mrp: number;
  sellingPrice: number;
  stock: number;
  sku?: string;
  ingredients?: string;
  usage?: string;
  benefits?: string;
  images?: string;
  stockNote?: string;
  metaTitle?: string;
  metaDescription?: string;
  lowStockThreshold?: number;
};

export type UpsertProductResult =
  | { ok: true; productId: string }
  | { ok: false; error: string };

function parseLines(value: string | undefined) {
  return String(value || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function fail(error: string, meta?: Record<string, unknown>): UpsertProductResult {
  console.error("[upsertProduct]", error, meta || "");
  void import("@/lib/logging/system-log")
    .then(({ logError }) =>
      logError({
        category: "admin",
        action: "PRODUCT_SAVE_FAILED",
        message: error.slice(0, 2000),
        entityType: "Product",
        meta: meta || null,
      })
    )
    .catch(() => {});
  return { ok: false, error };
}

/**
 * Create or update a product. Never throws — production digests Server Action
 * errors into a generic RSC message, so callers must check `{ ok, error }`.
 */
export async function upsertProduct(input: UpsertProductInput): Promise<UpsertProductResult> {
  try {
    await requirePermission("products", "edit");
  } catch {
    return fail("You do not have permission to edit products");
  }

  const raw = {
    id: input.id?.trim() || undefined,
    title: String(input.title || ""),
    brand: String(input.brand || ""),
    category: String(input.category || ""),
    description: String(input.description || ""),
    volume: String(input.volume || ""),
    mrp: Number(input.mrp),
    sellingPrice: Number(input.sellingPrice),
    stock: Number(input.stock),
    sku: String(input.sku || ""),
    ingredients: String(input.ingredients || ""),
    usage: String(input.usage || ""),
    benefits: parseLines(input.benefits),
    images: parseLines(input.images).map(sanitizeImageUrl).filter(Boolean),
    stockNote: String(input.stockNote || "") || undefined,
    metaTitle: String(input.metaTitle || "").trim() || undefined,
    metaDescription: String(input.metaDescription || "").trim() || undefined,
    lowStockThreshold:
      input.lowStockThreshold != null && String(input.lowStockThreshold) !== ""
        ? Number(input.lowStockThreshold)
        : undefined,
  };

  const parsed = ProductFormSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "Invalid product");
  }

  const {
    id,
    mrp,
    sellingPrice,
    stock,
    title,
    images,
    stockNote,
    metaTitle,
    metaDescription,
    lowStockThreshold,
    ...rest
  } = parsed.data;

  if (sellingPrice > mrp) {
    return fail("Selling price cannot exceed MRP");
  }

  const discount = mrp > 0 ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;
  const slug = slugify(title);
  if (!slug) {
    return fail("Title must include letters or numbers");
  }

  const benefitsJson = JSON.stringify(rest.benefits);
  const imagesJson = JSON.stringify(images.length ? images : ["/products/placeholder.jpg"]);
  const metaTitleVal = metaTitle || null;
  const metaDescriptionVal = metaDescription || null;
  const threshold = lowStockThreshold ?? 5;
  const volume = rest.volume || null;
  const ingredients = rest.ingredients || null;
  const usageVal = rest.usage || null;
  const brand = (rest.brand || "").trim() || "Alpainoo";
  const description = (rest.description || "").trim() || title;
  let sku = (rest.sku || "").trim();

  let productId = id || cuidLike();
  if (!sku) {
    sku = `ALP-${productId.replace(/^c/, "").slice(0, 10).toUpperCase()}`;
  }

  let categoryId: string | null = null;

  const db = await getD1();
  if (!db) {
    // Never fall through to Prisma on Workers — that throws a digested RSC error.
    return fail("Database unavailable. Please refresh and try again.");
  }

  const d1 = asD1(db);
  const now = sqlNow();

  try {
    const catRow = await d1
      .prepare(`SELECT id FROM Category WHERE name = ? OR slug = ? LIMIT 1`)
      .bind(rest.category, slugify(rest.category))
      .first();
    if (catRow) categoryId = String((catRow as { id: string }).id);
  } catch (err) {
    console.warn("[upsertProduct] category lookup failed:", err);
  }

  try {
    if (id) {
      const prev = await d1
        .prepare(`SELECT stock, sku FROM Product WHERE id = ? LIMIT 1`)
        .bind(id)
        .first();
      if (!prev) return fail("Product not found");
      const prevStock = Number((prev as { stock: number }).stock);
      if (!(rest.sku || "").trim()) {
        sku = String((prev as { sku: string }).sku);
      }

      // Quote "usage" — column name can confuse some SQL parsers.
      await d1
        .prepare(
          `UPDATE Product SET title = ?, slug = ?, description = ?, brand = ?, volume = ?, mrp = ?, sellingPrice = ?,
           discount = ?, sku = ?, stock = ?, category = ?, categoryId = ?, benefits = ?, ingredients = ?, "usage" = ?, images = ?,
           metaTitle = ?, metaDescription = ?, lowStockThreshold = ?, updatedAt = ?
           WHERE id = ?`
        )
        .bind(
          title,
          slug,
          description,
          brand,
          volume,
          mrp,
          sellingPrice,
          discount,
          sku,
          stock,
          rest.category,
          categoryId,
          benefitsJson,
          ingredients,
          usageVal,
          imagesJson,
          metaTitleVal,
          metaDescriptionVal,
          threshold,
          now,
          id
        )
        .run();

      if (prevStock !== stock) {
        await d1
          .prepare(
            `INSERT INTO StockLog (id, productId, change, note, createdAt) VALUES (?, ?, ?, ?, ?)`
          )
          .bind(cuidLike(), id, stock - prevStock, stockNote || "Manual stock update", now)
          .run();
      }
      productId = id;
    } else {
      const clash = await d1
        .prepare(`SELECT id FROM Product WHERE sku = ? LIMIT 1`)
        .bind(sku)
        .first();
      if (clash) sku = `ALP-${cuidLike().slice(1, 11).toUpperCase()}`;

      const slugClash = await d1
        .prepare(`SELECT id FROM Product WHERE slug = ? LIMIT 1`)
        .bind(slug)
        .first();
      if (slugClash) {
        return fail("A product with this title already exists — change the title slightly");
      }

      await d1
        .prepare(
          `INSERT INTO Product (id, title, slug, description, brand, volume, mrp, sellingPrice, discount, sku, stock,
           category, categoryId, benefits, ingredients, "usage", images, rating, reviewCount, isHidden, metaTitle, metaDescription,
           lowStockThreshold, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4.5, 0, 0, ?, ?, ?, ?, ?)`
        )
        .bind(
          productId,
          title,
          slug,
          description,
          brand,
          volume,
          mrp,
          sellingPrice,
          discount,
          sku,
          stock,
          rest.category,
          categoryId,
          benefitsJson,
          ingredients,
          usageVal,
          imagesJson,
          metaTitleVal,
          metaDescriptionVal,
          threshold,
          now,
          now
        )
        .run();

      await d1
        .prepare(
          `INSERT INTO StockLog (id, productId, change, note, createdAt) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(cuidLike(), productId, stock, "Initial stock", now)
        .run();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|UNIQUE/i.test(msg)) {
      return fail("A product with this title or SKU already exists", { detail: msg });
    }
    return fail("Could not save product. Please try again.", { detail: msg });
  }

  try {
    revalidatePath("/admin/products");
    revalidatePath("/products");
    if (productId) revalidatePath(`/admin/products/${productId}`);
    if (slug) revalidatePath(`/products/${slug}`);
  } catch (err) {
    console.warn("[upsertProduct] revalidate failed:", err);
  }

  void import("@/lib/logging/system-log").then(({ logSuccess }) =>
    logSuccess({
      category: "admin",
      action: id ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
      message: id ? `Product updated: ${title}` : `Product created: ${title}`,
      entityType: "Product",
      entityId: productId,
      meta: { sku, stock },
    })
  );
  void import("@/lib/logging/db-audit").then(({ writeDbAudit }) =>
    writeDbAudit({
      tableName: "Product",
      operation: id ? "UPDATE" : "INSERT",
      rowId: productId,
      newData: { id: productId, title, stock, sku },
    })
  );

  return { ok: true, productId };
}
