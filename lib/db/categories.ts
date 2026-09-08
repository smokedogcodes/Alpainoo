import { asD1, cuidLike, getD1, sqlNow, toDate } from "@/lib/db/d1";
import { DEFAULT_CATEGORY_NAMES } from "@/lib/constants/categories";
import { slugify } from "@/lib/utils";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export { DEFAULT_CATEGORY_NAMES };

function mapCategory(row: Record<string, unknown>): CategoryRow {
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

export async function listCategoriesDb(): Promise<CategoryRow[]> {
  const db = await getD1();
  if (db) {
    try {
      const res = await asD1(db)
        .prepare(`SELECT * FROM Category ORDER BY sortOrder ASC, name ASC`)
        .all();
      return (res.results || []).map((r: Record<string, unknown>) => mapCategory(r));
    } catch (err) {
      console.error("[categories] list failed:", err);
      return [];
    }
  }

  try {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    return prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  } catch (err) {
    console.error("[categories] prisma list failed:", err);
    return [];
  }
}

/** Ensure Category master has default rows. Safe to call from admin pages. */
export async function ensureDefaultCategoriesDb(): Promise<CategoryRow[]> {
  const existing = await listCategoriesDb();
  if (existing.length > 0) return existing;

  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    const now = sqlNow();
    for (let i = 0; i < DEFAULT_CATEGORY_NAMES.length; i++) {
      const name = DEFAULT_CATEGORY_NAMES[i];
      try {
        await d1
          .prepare(
            `INSERT INTO Category (id, name, slug, description, sortOrder, createdAt, updatedAt)
             VALUES (?, ?, ?, NULL, ?, ?, ?)`
          )
          .bind(cuidLike(), name, slugify(name), i, now, now)
          .run();
      } catch {
        /* ignore duplicates */
      }
    }
    return listCategoriesDb();
  }

  try {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    for (let i = 0; i < DEFAULT_CATEGORY_NAMES.length; i++) {
      const name = DEFAULT_CATEGORY_NAMES[i];
      try {
        await prisma.category.create({
          data: { name, slug: slugify(name), sortOrder: i },
        });
      } catch {
        /* ignore */
      }
    }
    return listCategoriesDb();
  } catch {
    return [];
  }
}
