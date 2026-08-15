import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product/product-card";
import { ProductFilters } from "@/components/product/product-filters";

type SearchParams = {
  q?: string;
  category?: string;
  brand?: string;
  min?: string;
  max?: string;
  inStock?: string;
  sort?: string;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const where: Record<string, unknown> = { isHidden: false };

  if (searchParams.q) {
    where.OR = [
      { title: { contains: searchParams.q } },
      { brand: { contains: searchParams.q } },
      { category: { contains: searchParams.q } },
    ];
  }
  if (searchParams.category) where.category = searchParams.category;
  if (searchParams.brand) where.brand = searchParams.brand;
  if (searchParams.inStock === "1") where.stock = { gt: 0 };
  if (searchParams.min || searchParams.max) {
    where.sellingPrice = {
      ...(searchParams.min ? { gte: Number(searchParams.min) } : {}),
      ...(searchParams.max ? { lte: Number(searchParams.max) } : {}),
    };
  }

  let orderBy: Record<string, string> = { reviewCount: "desc" };
  if (searchParams.sort === "price-asc") orderBy = { sellingPrice: "asc" };
  if (searchParams.sort === "price-desc") orderBy = { sellingPrice: "desc" };
  if (searchParams.sort === "newest") orderBy = { createdAt: "desc" };

  const [products, brands, categories] = await Promise.all([
    prisma.product.findMany({ where, orderBy }),
    prisma.product.findMany({
      where: { isHidden: false },
      distinct: ["brand"],
      select: { brand: true },
    }),
    prisma.product.findMany({
      where: { isHidden: false },
      distinct: ["category"],
      select: { category: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-store px-4 py-8 md:px-6">
      <h1 className="font-display text-3xl md:text-4xl">Shop All</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <ProductFilters
          brands={brands.map((b) => b.brand)}
          categories={categories.map((c) => c.category)}
          current={searchParams}
        />
        <div>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Sale Offers", image: "/collections/pink-flower.jpg", href: "/sale" },
              { label: "Hair Serum", image: "/hero/green-leaves.jpg", href: "/products?category=Hair+Serum" },
              { label: "Face Essential", image: "/plp/face.jpg", href: "/products?category=Face+Essential" },
            ].map((c) => (
              <a
                key={c.label}
                href={c.href}
                className="relative flex min-h-[140px] flex-col items-center justify-center overflow-hidden rounded-lg bg-blush-soft px-4 text-center"
              >
                <Image
                  src={c.image}
                  alt=""
                  fill
                  sizes="(max-width:640px) 100vw, 33vw"
                  quality={90}
                  className="object-cover opacity-35"
                />
                <div className="absolute inset-0 bg-blush-soft/55" />
                <span className="relative font-display text-xl text-foreground">{c.label}</span>
                <span className="relative mt-1 text-xs text-muted">
                  {c.label === "Sale Offers" ? "View running sale" : "View all products"}
                </span>
              </a>
            ))}
          </div>
          <p className="mb-4 text-sm text-muted">{products.length} products</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {!products.length && (
            <p className="py-16 text-center text-muted">No products match your filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}
