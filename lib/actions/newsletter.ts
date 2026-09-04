"use server";

import { z } from "zod";
import { asD1, cuidLike, getD1, sqlNow } from "@/lib/db/d1";

const EmailSchema = z.string().trim().email().max(200);

export async function subscribeEmail(email: string) {
  const parsed = EmailSchema.safeParse(email);
  if (!parsed.success) throw new Error("Valid email required");
  const normalized = parsed.data.toLowerCase();

  const db = await getD1();
  if (db) {
    const existing = await asD1(db)
      .prepare(`SELECT id, active FROM NewsletterSubscriber WHERE email = ? LIMIT 1`)
      .bind(normalized)
      .first();
    if (existing) {
      if (!existing.active) {
        await asD1(db)
          .prepare(`UPDATE NewsletterSubscriber SET active = 1 WHERE id = ?`)
          .bind(existing.id)
          .run();
      }
      return { ok: true as const, already: true };
    }
    await asD1(db)
      .prepare(
        `INSERT INTO NewsletterSubscriber (id, email, active, createdAt) VALUES (?, ?, 1, ?)`
      )
      .bind(cuidLike(), normalized, sqlNow())
      .run();
    return { ok: true as const, already: false };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email: normalized },
  });
  if (existing) {
    if (!existing.active) {
      await prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { active: true },
      });
    }
    return { ok: true as const, already: true };
  }
  await prisma.newsletterSubscriber.create({
    data: { email: normalized, active: true },
  });
  return { ok: true as const, already: false };
}
