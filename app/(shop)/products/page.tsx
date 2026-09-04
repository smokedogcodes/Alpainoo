import Image from "next/image";
import { listProductFacets, listProducts } from "@/lib/db/products";
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
  const query = searchParams.q?.trim();

  let orderBy: "reviewCount" | "createdAt" | "sellingPrice" = "reviewCount";
  let orderDir: "asc" | "desc" = "desc";
  if (searchParams.sort === "price-asc") {
    orderBy = "sellingPrice";
    orderDir = "asc";
  } else if (searchParams.sort === "price-desc") {
    orderBy = "sellingPrice";
    orderDir = "desc";
  } else if (searchParams.sort === "newest") {
    orderBy = "createdAt";
    orderDir = "desc";
  }

  const [products, facets] = await Promise.all([
    listProducts({
      q: query,
      category: searchParams.category,
      brand: searchParams.brand,
      inStock: searchParams.inStock === "1",
      minPrice: searchParams.min ? Number(searchParams.min) : undefined,
      maxPrice: searchParams.max ? Number(searchParams.max) : undefined,
      orderBy,
      orderDir,
    }),
    listProductFacets(),
  ]);
  const brands = facets.brands;
  const categories = facets.categories;

  return (
    <div className="mx-auto max-w-store px-4 py-8 md:px-6">
      <h1 className="font-display text-3xl md:text-4xl">
        {query ? `Results for “${query}”` : "Shop All"}
      </h1>
      {query && (
        <p className="mt-2 text-sm text-muted">
          Showing matches in title, brand, category, and SKU.{" "}
          <a href="/products" className="text-sage underline underline-offset-2">
            Clear search
          </a>
        </p>
      )}
      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <ProductFilters
          brands={brands}
          categories={categories}
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
                  quality={75}
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
