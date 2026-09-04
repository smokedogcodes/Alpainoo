import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listProductsD1 } from "@/lib/db/d1-products";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.DEBUG_CF !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const ctx = await getCloudflareContext({ async: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (ctx as any)?.env as { DB?: D1Database } | undefined;
    const db = env?.DB;
    if (!db) {
      return NextResponse.json({ ok: false, error: "no DB" });
    }
    const products = await listProductsD1(db, { take: 2 });
    return NextResponse.json({
      ok: true,
      hasDB: true,
      sample: products.map((p) => ({ slug: p.slug, title: p.title })),
      count: products.length,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
