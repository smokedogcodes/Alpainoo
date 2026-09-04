import { NextResponse } from "next/server";
import { parseJsonArray } from "@/lib/utils";
import { SearchQuerySchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { searchProductsLite } from "@/lib/db/products";

export async function GET(req: Request) {
  const limited = await rateLimit(`search:${clientIp(req)}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = SearchQuerySchema.safeParse({ q: searchParams.get("q") || "" });
  if (!parsed.success) {
    return NextResponse.json({ products: [] });
  }
  const q = parsed.data.q;

  const products = await searchProductsLite(q, 3);

  return NextResponse.json({
    products: products.map((p) => {
      const images = parseJsonArray(p.images);
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        brand: p.brand,
        category: p.category,
        sellingPrice: p.sellingPrice,
        image: images[0] || "/products/placeholder.jpg",
      };
    }),
  });
}
