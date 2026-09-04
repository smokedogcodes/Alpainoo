import { NextResponse } from "next/server";
import { z } from "zod";
import { getD1 } from "@/lib/db/d1";

const BodySchema = z.object({
  email: z.string().trim().email().max(200),
  items: z.array(z.unknown()).max(100),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const payload = JSON.stringify(parsed.data.items);

  // On Workers with D1, AbandonedCart may be missing — skip softly.
  const d1 = await getD1();
  if (d1) {
    try {
      const { asD1, cuidLike, sqlNow } = await import("@/lib/db/d1");
      const now = sqlNow();
      await asD1(d1)
        .prepare(
          `INSERT INTO AbandonedCart (id, email, payload, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(cuidLike(), email, payload, now, now)
        .run();
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.warn("[abandoned-cart] D1 skip:", err);
      return NextResponse.json({ ok: true, skipped: true });
    }
  }

  try {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.abandonedCart.create({
      data: { email, payload },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("[abandoned-cart] prisma skip:", err);
    return NextResponse.json({ ok: true, skipped: true });
  }
}
