import { asD1, cuidLike, getD1, sqlNow, toDate } from "@/lib/db/d1";

export type EmailOtpRow = {
  id: string;
  email: string;
  userId: string | null;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  lastSentAt: Date;
  createdAt: Date;
};

function mapOtp(row: Record<string, unknown>): EmailOtpRow {
  return {
    id: String(row.id),
    email: String(row.email),
    userId: row.userId != null ? String(row.userId) : null,
    codeHash: String(row.codeHash),
    attempts: Number(row.attempts ?? 0),
    expiresAt: toDate(row.expiresAt),
    lastSentAt: toDate(row.lastSentAt),
    createdAt: toDate(row.createdAt),
  };
}

export async function findEmailOtpByEmail(email: string): Promise<EmailOtpRow | null> {
  const normalized = email.trim().toLowerCase();
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const row = await prisma.emailOtp.findUnique({ where: { email: normalized } });
    return row
      ? {
          id: row.id,
          email: row.email,
          userId: row.userId,
          codeHash: row.codeHash,
          attempts: row.attempts,
          expiresAt: row.expiresAt,
          lastSentAt: row.lastSentAt,
          createdAt: row.createdAt,
        }
      : null;
  }
  const row = await asD1(db)
    .prepare(`SELECT * FROM EmailOtp WHERE email = ? LIMIT 1`)
    .bind(normalized)
    .first();
  return row ? mapOtp(row as Record<string, unknown>) : null;
}

export async function upsertEmailOtp(input: {
  email: string;
  codeHash: string;
  expiresAt: Date;
  lastSentAt: Date;
  userId?: string | null;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.emailOtp.upsert({
      where: { email },
      create: {
        email,
        codeHash: input.codeHash,
        attempts: 0,
        expiresAt: input.expiresAt,
        lastSentAt: input.lastSentAt,
        userId: input.userId || null,
      },
      update: {
        codeHash: input.codeHash,
        attempts: 0,
        expiresAt: input.expiresAt,
        lastSentAt: input.lastSentAt,
        userId: input.userId || null,
      },
    });
    return;
  }

  const d1 = asD1(db);
  const existing = await d1
    .prepare(`SELECT id FROM EmailOtp WHERE email = ? LIMIT 1`)
    .bind(email)
    .first();
  const expiresIso = input.expiresAt.toISOString();
  const sentIso = input.lastSentAt.toISOString();
  const userId = input.userId || null;

  if (existing) {
    await d1
      .prepare(
        `UPDATE EmailOtp SET codeHash = ?, attempts = 0, expiresAt = ?, lastSentAt = ?, userId = ? WHERE email = ?`
      )
      .bind(input.codeHash, expiresIso, sentIso, userId, email)
      .run();
    return;
  }

  await d1
    .prepare(
      `INSERT INTO EmailOtp (id, email, userId, codeHash, attempts, expiresAt, lastSentAt, createdAt)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
    )
    .bind(cuidLike(), email, userId, input.codeHash, expiresIso, sentIso, sqlNow())
    .run();
}

export async function incrementEmailOtpAttempts(email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const row = await prisma.emailOtp.update({
      where: { email: normalized },
      data: { attempts: { increment: 1 } },
    });
    return row.attempts;
  }
  await asD1(db)
    .prepare(`UPDATE EmailOtp SET attempts = attempts + 1 WHERE email = ?`)
    .bind(normalized)
    .run();
  const row = await findEmailOtpByEmail(normalized);
  return row?.attempts ?? 0;
}

export async function deleteEmailOtp(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.emailOtp.deleteMany({ where: { email: normalized } });
    return;
  }
  await asD1(db).prepare(`DELETE FROM EmailOtp WHERE email = ?`).bind(normalized).run();
}
