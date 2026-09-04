import type { BlogPost } from "@prisma/client";
import { asD1, cuidLike, getD1, sqlNow, toBool, toDate } from "@/lib/db/d1";

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
    scheduledAt: row.scheduledAt != null ? toDate(row.scheduledAt) : null,
    metaTitle: row.metaTitle != null ? String(row.metaTitle) : null,
    metaDescription:
      row.metaDescription != null ? String(row.metaDescription) : null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  } as BlogPost;
}

export type UpsertBlogPostInput = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  published: boolean;
  tags: string;
  coverImage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  scheduledAt: Date | null;
};

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

export async function listAdminPosts(): Promise<BlogPost[]> {
  const db = await getD1();
  if (db) {
    const result = await asD1(db)
      .prepare(`SELECT * FROM BlogPost ORDER BY updatedAt DESC`)
      .all();
    return (result.results || []).map((r: Record<string, unknown>) => mapPost(r));
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.blogPost.findMany({ orderBy: { updatedAt: "desc" } });
}

export async function getPostById(id: string): Promise<BlogPost | null> {
  const db = await getD1();
  if (db) {
    const row = await asD1(db)
      .prepare(`SELECT * FROM BlogPost WHERE id = ? LIMIT 1`)
      .bind(id)
      .first();
    return row ? mapPost(row as Record<string, unknown>) : null;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.blogPost.findUnique({ where: { id } });
}

export async function upsertBlogPost(data: UpsertBlogPostInput): Promise<BlogPost> {
  const db = await getD1();
  const scheduledAtIso = data.scheduledAt ? data.scheduledAt.toISOString() : null;

  if (db) {
    const d1 = asD1(db);
    const now = sqlNow();
    if (data.id) {
      await d1
        .prepare(
          `UPDATE BlogPost SET title = ?, slug = ?, excerpt = ?, content = ?, published = ?, tags = ?,
           coverImage = ?, metaTitle = ?, metaDescription = ?, scheduledAt = ?, updatedAt = ?
           WHERE id = ?`
        )
        .bind(
          data.title,
          data.slug,
          data.excerpt,
          data.content,
          data.published ? 1 : 0,
          data.tags,
          data.coverImage,
          data.metaTitle,
          data.metaDescription,
          scheduledAtIso,
          now,
          data.id
        )
        .run();
      const row = await d1
        .prepare(`SELECT * FROM BlogPost WHERE id = ? LIMIT 1`)
        .bind(data.id)
        .first();
      if (!row) throw new Error("Blog post not found after update");
      return mapPost(row as Record<string, unknown>);
    }

    const id = cuidLike();
    await d1
      .prepare(
        `INSERT INTO BlogPost (id, title, slug, excerpt, content, coverImage, tags, published, scheduledAt, metaTitle, metaDescription, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.title,
        data.slug,
        data.excerpt,
        data.content,
        data.coverImage,
        data.tags,
        data.published ? 1 : 0,
        scheduledAtIso,
        data.metaTitle,
        data.metaDescription,
        now,
        now
      )
      .run();
    const row = await d1
      .prepare(`SELECT * FROM BlogPost WHERE id = ? LIMIT 1`)
      .bind(id)
      .first();
    if (!row) throw new Error("Failed to create blog post");
    return mapPost(row as Record<string, unknown>);
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const payload = {
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt,
    content: data.content,
    published: data.published,
    tags: data.tags,
    coverImage: data.coverImage,
    metaTitle: data.metaTitle,
    metaDescription: data.metaDescription,
    scheduledAt: data.scheduledAt,
  };
  if (data.id) {
    return prisma.blogPost.update({ where: { id: data.id }, data: payload });
  }
  return prisma.blogPost.create({ data: payload });
}

export async function deleteBlogPost(id: string): Promise<void> {
  const db = await getD1();
  if (db) {
    await asD1(db).prepare(`DELETE FROM BlogPost WHERE id = ?`).bind(id).run();
    return;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  await prisma.blogPost.delete({ where: { id } });
}
