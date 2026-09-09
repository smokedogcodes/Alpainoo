import { asD1, cuidLike, getD1, sqlNow, toDate } from "@/lib/db/d1";

export type PhoneOtpRow = {
  id: string;
  userId: string;
  phone: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  lastSentAt: Date;
  createdAt: Date;
};

function mapOtp(row: Record<string, unknown>): PhoneOtpRow {
  return {
    id: String(row.id),
    userId: String(row.userId),
    phone: String(row.phone),
    codeHash: String(row.codeHash),
    attempts: Number(row.attempts ?? 0),
    expiresAt: toDate(row.expiresAt),
    lastSentAt: toDate(row.lastSentAt),
    createdAt: toDate(row.createdAt),
  };
}

export async function findPhoneOtpByUserId(userId: string): Promise<PhoneOtpRow | null> {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const row = await prisma.phoneOtp.findUnique({ where: { userId } });
    return row
      ? {
          id: row.id,
          userId: row.userId,
          phone: row.phone,
          codeHash: row.codeHash,
          attempts: row.attempts,
          expiresAt: row.expiresAt,
          lastSentAt: row.lastSentAt,
          createdAt: row.createdAt,
        }
      : null;
  }
  const row = await asD1(db)
    .prepare(`SELECT * FROM PhoneOtp WHERE userId = ? LIMIT 1`)
    .bind(userId)
    .first();
  return row ? mapOtp(row as Record<string, unknown>) : null;
}

export async function upsertPhoneOtp(input: {
  userId: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  lastSentAt: Date;
}): Promise<void> {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.phoneOtp.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        phone: input.phone,
        codeHash: input.codeHash,
        attempts: 0,
        expiresAt: input.expiresAt,
        lastSentAt: input.lastSentAt,
      },
      update: {
        phone: input.phone,
        codeHash: input.codeHash,
        attempts: 0,
        expiresAt: input.expiresAt,
        lastSentAt: input.lastSentAt,
      },
    });
    return;
  }

  const d1 = asD1(db);
  const existing = await d1
    .prepare(`SELECT id FROM PhoneOtp WHERE userId = ? LIMIT 1`)
    .bind(input.userId)
    .first();
  const expiresIso = input.expiresAt.toISOString();
  const sentIso = input.lastSentAt.toISOString();

  if (existing) {
    await d1
      .prepare(
        `UPDATE PhoneOtp SET phone = ?, codeHash = ?, attempts = 0, expiresAt = ?, lastSentAt = ? WHERE userId = ?`
      )
      .bind(input.phone, input.codeHash, expiresIso, sentIso, input.userId)
      .run();
    return;
  }

  await d1
    .prepare(
      `INSERT INTO PhoneOtp (id, userId, phone, codeHash, attempts, expiresAt, lastSentAt, createdAt)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
    )
    .bind(
      cuidLike(),
      input.userId,
      input.phone,
      input.codeHash,
      expiresIso,
      sentIso,
      sqlNow()
    )
    .run();
}

export async function incrementPhoneOtpAttempts(userId: string): Promise<number> {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const row = await prisma.phoneOtp.update({
      where: { userId },
      data: { attempts: { increment: 1 } },
    });
    return row.attempts;
  }
  await asD1(db)
    .prepare(`UPDATE PhoneOtp SET attempts = attempts + 1 WHERE userId = ?`)
    .bind(userId)
    .run();
  const row = await findPhoneOtpByUserId(userId);
  return row?.attempts ?? 0;
}

export async function deletePhoneOtp(userId: string): Promise<void> {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.phoneOtp.deleteMany({ where: { userId } });
    return;
  }
  await asD1(db).prepare(`DELETE FROM PhoneOtp WHERE userId = ?`).bind(userId).run();
}
