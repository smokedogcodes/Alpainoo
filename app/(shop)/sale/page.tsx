import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sale & Offers",
  description: "Shop discounted serums, creams, haircare and more — limited-time Elorakart offers.",
};

export default async function SalePage() {
  const products = await prisma.product.findMany({
    where: {
      isHidden: false,
      discount: { gt: 0 },
      stock: { gt: 0 },
    },
    orderBy: [{ discount: "desc" }, { reviewCount: "desc" }],
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
              <p className="font-display text-2xl">{products.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-white/80 px-4 py-3 text-sm">
              <p className="text-muted">Top discount</p>
              <p className="font-display text-2xl text-price-sale">{maxDiscount}%</p>
            </div>
            <div className="rounded-lg border border-border bg-white/80 px-4 py-3 text-sm">
              <p className="text-muted">Avg. off</p>
              <p className="font-display text-2xl">{avgDiscount}%</p>
            </div>
            <div className="rounded-lg border border-border bg-white/80 px-4 py-3 text-sm">
              <p className="text-muted">You can save up to</p>
              <p className="font-display text-2xl">{formatINR(totalSavings)}</p>
            </div>
          </div>
          <Button asChild variant="outline" className="mt-8">
            <Link href="/products">Browse full catalog</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-store px-4 py-12 md:px-6">
        {!products.length ? (
          <div className="rounded-lg border border-dashed border-border bg-white py-20 text-center">
            <p className="font-display text-2xl">No active sales right now</p>
            <p className="mt-2 text-sm text-muted">Check back soon — or explore the full shop.</p>
            <Button asChild className="mt-6">
              <Link href="/products">Shop all products</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-3xl tracking-wide">Discounted products</h2>
                <p className="text-sm text-muted">Sorted by biggest discount first</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
