import type { KnowledgeArticle } from "@prisma/client";
import { asD1, cuidLike, getD1, sqlNow, toBool, toDate } from "@/lib/db/d1";

function mapArticle(row: Record<string, unknown>): KnowledgeArticle {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    question: String(row.question),
    answer: String(row.answer),
    keywords: String(row.keywords ?? "[]"),
    category: String(row.category ?? "GENERAL"),
    active: toBool(row.active),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export async function listKnowledgeArticles(): Promise<KnowledgeArticle[]> {
  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(`SELECT * FROM KnowledgeArticle ORDER BY updatedAt DESC`)
      .all();
    return ((res.results || []) as Record<string, unknown>[]).map(mapArticle);
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.knowledgeArticle.findMany({ orderBy: { updatedAt: "desc" } });
}

export async function upsertKnowledgeArticleDb(input: {
  id?: string;
  slug: string;
  title: string;
  question: string;
  answer: string;
  keywords: string;
  category: string;
  active: boolean;
}) {
  const db = await getD1();
  const now = sqlNow();
  if (db) {
    const d1 = asD1(db);
    if (input.id) {
      await d1
        .prepare(
          `UPDATE KnowledgeArticle
           SET slug = ?, title = ?, question = ?, answer = ?, keywords = ?, category = ?, active = ?, updatedAt = ?
           WHERE id = ?`
        )
        .bind(
          input.slug,
          input.title,
          input.question,
          input.answer,
          input.keywords,
          input.category,
          input.active ? 1 : 0,
          now,
          input.id
        )
        .run();
    } else {
      await d1
        .prepare(
          `INSERT INTO KnowledgeArticle
           (id, slug, title, question, answer, keywords, category, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          cuidLike(),
          input.slug,
          input.title,
          input.question,
          input.answer,
          input.keywords,
          input.category,
          input.active ? 1 : 0,
          now,
          now
        )
        .run();
    }
    return;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const data = {
    slug: input.slug,
    title: input.title,
    question: input.question,
    answer: input.answer,
    keywords: input.keywords,
    category: input.category,
    active: input.active,
  };
  if (input.id) {
    await prisma.knowledgeArticle.update({ where: { id: input.id }, data });
  } else {
    await prisma.knowledgeArticle.create({ data });
  }
}

export async function deleteKnowledgeArticleDb(id: string) {
  const db = await getD1();
  if (db) {
    await asD1(db).prepare(`DELETE FROM KnowledgeArticle WHERE id = ?`).bind(id).run();
    return;
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  await prisma.knowledgeArticle.delete({ where: { id } });
}

export async function toggleKnowledgeArticleDb(id: string, active: boolean) {
  const db = await getD1();
  if (db) {
    await asD1(db)
      .prepare(`UPDATE KnowledgeArticle SET active = ?, updatedAt = ? WHERE id = ?`)
      .bind(active ? 1 : 0, sqlNow(), id)
      .run();
    return;
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  await prisma.knowledgeArticle.update({ where: { id }, data: { active } });
}
