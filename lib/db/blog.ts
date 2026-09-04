import type { BlogPost } from "@prisma/client";
import { asD1, getD1, toBool, toDate } from "@/lib/db/d1";

function mapPost(row: Record<string, unknown>): BlogPost {
  return {
    id: String(row.id),
    title: String(row.title),
    slug: String(row.slug),
    excerpt: String(row.excerpt ?? ""),
    content: String(row.content ?? ""),
    coverImage: row.coverImage != null ? String(row.coverImage) : null,
    tags: String(row.tags ?? "[]"),
    published: toBool(row.published),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  } as BlogPost;
}

export async function listPublishedPostsD1(db: D1Database): Promise<BlogPost[]> {
  const result = await asD1(db)
    .prepare(
      `SELECT * FROM BlogPost WHERE published = 1 ORDER BY createdAt DESC`
    )
    .all();
  return (result.results || []).map((r: Record<string, unknown>) => mapPost(r));
}

export async function getPostBySlugD1(
  db: D1Database,
  slug: string
): Promise<BlogPost | null> {
  const row = await asD1(db)
    .prepare(`SELECT * FROM BlogPost WHERE slug = ? AND published = 1 LIMIT 1`)
    .bind(slug)
    .first();
  return row ? mapPost(row as Record<string, unknown>) : null;
}

export async function listPublishedPosts(): Promise<BlogPost[]> {
  const db = await getD1();
  if (db) return listPublishedPostsD1(db);

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = await getD1();
  if (db) return getPostBySlugD1(db, slug);

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published) return null;
  return post;
}
