"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/admin";
import { asD1, cuidLike, getD1, sqlNow } from "@/lib/db/d1";

const CouponSchema = z
  .object({
    code: z.string().trim().min(2).max(40),
    description: z.string().trim().max(200).optional(),
    kind: z.enum(["PERCENT", "FIXED", "PERCENT_CAPPED", "FREE_SHIPPING"]),
    percentOff: z.number().min(0).max(100).optional(),
    amountOff: z.number().min(0).max(1_000_000).optional(),
    minOrder: z.number().min(0).max(1_000_000).optional(),
    maxUses: z.number().int().min(1).max(1_000_000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "PERCENT") {
      if (!data.percentOff || data.percentOff <= 0) {
        ctx.addIssue({ code: "custom", message: "Percent off is required", path: ["percentOff"] });
      }
    } else if (data.kind === "FIXED") {
      if (!data.amountOff || data.amountOff <= 0) {
        ctx.addIssue({ code: "custom", message: "Amount off is required", path: ["amountOff"] });
      }
    } else if (data.kind === "PERCENT_CAPPED") {
      if (!data.percentOff || data.percentOff <= 0) {
        ctx.addIssue({ code: "custom", message: "Percent off is required", path: ["percentOff"] });
      }
      if (!data.amountOff || data.amountOff <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Max discount (upto ₹) is required",
          path: ["amountOff"],
        });
      }
    }
  });

export async function createCoupon(formData: FormData) {
  await requirePermission("coupons", "edit");

  const kindRaw = String(formData.get("kind") || "PERCENT").toUpperCase();
  const raw = {
    code: String(formData.get("code") || "").toUpperCase(),
    description: String(formData.get("description") || "") || undefined,
    kind: kindRaw,
    percentOff: formData.get("percentOff") ? Number(formData.get("percentOff")) : undefined,
    amountOff: formData.get("amountOff") ? Number(formData.get("amountOff")) : undefined,
    minOrder: formData.get("minOrder") ? Number(formData.get("minOrder")) : 0,
    maxUses: formData.get("maxUses") ? Number(formData.get("maxUses")) : undefined,
  };

  const parsed = CouponSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid coupon");

  const kind = parsed.data.kind;
  const percentOff =
    kind === "PERCENT" || kind === "PERCENT_CAPPED" ? parsed.data.percentOff ?? null : null;
  const amountOff =
    kind === "FIXED" || kind === "PERCENT_CAPPED" ? parsed.data.amountOff ?? null : null;

  const db = await getD1();
  if (db) {
    const now = sqlNow();
    try {
      await asD1(db)
        .prepare(
          `INSERT INTO Coupon (id, code, description, kind, percentOff, amountOff, minOrder, maxUses, usedCount, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`
        )
        .bind(
          cuidLike(),
          parsed.data.code,
          parsed.data.description || null,
          kind,
          percentOff,
          amountOff,
          parsed.data.minOrder ?? 0,
          parsed.data.maxUses ?? null,
          now,
          now
        )
        .run();
    } catch {
      await asD1(db)
        .prepare(
          `INSERT INTO Coupon (id, code, description, percentOff, amountOff, minOrder, maxUses, usedCount, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`
        )
        .bind(
          cuidLike(),
          parsed.data.code,
          parsed.data.description || null,
          percentOff,
          amountOff,
          parsed.data.minOrder ?? 0,
          parsed.data.maxUses ?? null,
          now,
          now
        )
        .run();
    }
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.coupon.create({
      data: {
        code: parsed.data.code,
        description: parsed.data.description || null,
        kind,
        percentOff,
        amountOff,
        minOrder: parsed.data.minOrder ?? 0,
        maxUses: parsed.data.maxUses ?? null,
        active: true,
      },
    });
  }

  revalidatePath("/admin/coupons");
}

export async function createCategoryAction(formData: FormData) {
  const { createCategory } = await import("@/lib/actions/categories");
  await createCategory({
    name: String(formData.get("name") || ""),
    description: String(formData.get("description") || "") || undefined,
    sortOrder: formData.get("sortOrder") ? Number(formData.get("sortOrder")) : 0,
  });
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products/new");
}

export async function sendNewsletterCampaign(formData: FormData) {
  await requirePermission("marketing", "edit");
  const subject = String(formData.get("subject") || "").trim();
  const bodyHtml = String(formData.get("bodyHtml") || "").trim();
  if (!subject || !bodyHtml) throw new Error("Subject and body required");

  let emails: string[] = [];

  const db = await getD1();
  if (db) {
    const id = cuidLike();
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `INSERT INTO EmailCampaign (id, subject, bodyHtml, sentAt, createdAt) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, subject, bodyHtml, now, now)
      .run();
    const res = await asD1(db)
      .prepare(`SELECT email FROM NewsletterSubscriber WHERE active = 1`)
      .all();
    emails = (res.results || []).map((r: Record<string, unknown>) => String(r.email));
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.emailCampaign.create({
      data: { subject, bodyHtml, sentAt: new Date() },
    });
    const subs = await prisma.newsletterSubscriber.findMany({
      where: { active: true },
      select: { email: true },
    });
    emails = subs.map((s) => s.email);
  }

  try {
    const { sendTransactionalEmail } = await import("@/lib/email/resend");
    for (const to of emails) {
      try {
        await sendTransactionalEmail({
          to,
          subject,
          html: bodyHtml,
          text: bodyHtml.replace(/<[^>]+>/g, " "),
        });
      } catch {
        /* fail-soft per recipient */
      }
    }
  } catch (err) {
    console.warn("[marketing] Resend unavailable:", err);
  }

  revalidatePath("/admin/marketing");
}
