import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 1) {
    return NextResponse.json({ products: [] });
  }

  const products = await prisma.product.findMany({
    where: {
      isHidden: false,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ reviewCount: "desc" }, { title: "asc" }],
    take: 3,
    select: {
      id: true,
      title: true,
      slug: true,
      brand: true,
      sellingPrice: true,
      images: true,
      category: true,
    },
  });

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
