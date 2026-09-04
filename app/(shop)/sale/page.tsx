import type { Metadata } from "next";
import Link from "next/link";
import { listProducts } from "@/lib/db/products";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sale & Offers",
  description: "Shop discounted serums, creams, haircare and more — limited-time Alpainoo offers.",
};

export default async function SalePage() {
  const products = await listProducts({
    onSale: true,
    inStock: true,
    orderBy: "discount",
    orderDir: "desc",
  });

  const maxDiscount = products[0]?.discount ?? 0;
  const avgDiscount = products.length
    ? Math.round(products.reduce((s, p) => s + p.discount, 0) / products.length)
    : 0;
  const totalSavings = products.reduce((s, p) => s + (p.mrp - p.sellingPrice), 0);

  return (
    <div className="bg-cream">
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-blush via-cream to-sage-muted/20">
        <div className="mx-auto max-w-store px-4 py-14 text-center md:px-6 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-terracotta">Limited offers</p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">Sale Running Now</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Handpicked discounts on serums, night creams, haircare and more. Prices update live from inventory.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <div className="rounded-lg border border-border bg-white/80 px-4 py-3 text-sm">
              <p className="text-muted">Products on sale</p>
              <p className="font-semibold text-sage">{products.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-white/80 px-4 py-3 text-sm">
              <p className="text-muted">Up to</p>
              <p className="font-semibold text-price-sale">{maxDiscount}% off</p>
            </div>
            <div className="rounded-lg border border-border bg-white/80 px-4 py-3 text-sm">
              <p className="text-muted">Avg. discount</p>
              <p className="font-semibold text-sage">{avgDiscount}%</p>
            </div>
            <div className="rounded-lg border border-border bg-white/80 px-4 py-3 text-sm">
              <p className="text-muted">Potential savings</p>
              <p className="font-semibold text-sage">{formatINR(totalSavings)}</p>
            </div>
          </div>
          <Button asChild className="mt-8 rounded-full px-8">
            <Link href="/products">Browse full catalog</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-store px-4 py-12 md:px-6">
        {products.length === 0 ? (
          <p className="text-center text-muted">No sale items right now — check back soon.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
