import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const bestsellers = await prisma.product.findMany({
    where: { isHidden: false },
    orderBy: { reviewCount: "desc" },
    take: 4,
  });
  const newest = await prisma.product.findMany({
    where: { isHidden: false },
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  return (
    <>
      {/*
        Hero uses a crisp SVG botanical illustration — not the ~512×286 Stitch PNG,
        which looked blurry when stretched full-bleed.
      */}
      <section className="relative isolate min-h-[78vh] overflow-hidden bg-cream md:min-h-[90vh]">
        <img
          src="/hero/botanical-bg.svg"
          alt="Elorakart botanical background"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center"
        />

        <div className="relative z-10 mx-auto flex min-h-[78vh] max-w-store flex-col items-center justify-center px-4 py-24 text-center md:min-h-[90vh] md:px-6">
          <div className="flex h-60 w-60 flex-col items-center justify-center rounded-full bg-[#e8cfc6] px-7 shadow-[0_8px_40px_rgba(185,122,86,0.12)] md:h-[19.5rem] md:w-[19.5rem] md:px-10">
            <p className="font-display text-2xl italic font-normal tracking-wide text-foreground/75 md:text-[1.75rem]">
              Elorakart
            </p>
            <h1 className="mt-2 font-display text-[1.35rem] font-semibold leading-snug tracking-wide text-foreground md:text-[1.85rem] text-balance">
              Your Ultimate Online Skincare Destination
            </h1>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="mt-5 rounded-full border-foreground/70 bg-cream/50 px-9 hover:bg-cream/90"
            >
              <Link href="/products">Shop Now</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-cream">
        <div className="mx-auto max-w-store px-4 py-3.5 md:px-6">
          <div className="flex justify-center gap-8 overflow-x-auto text-sm tracking-wide text-foreground/80">
            {[
              { label: "Sale", href: "/sale", highlight: true },
              { label: "Hair and Skin", href: "/products?category=Hair+Serum", active: true },
              { label: "Fragrances", href: "/products?category=Perfume" },
              { label: "Shop", href: "/products" },
              { label: "About", href: "/about" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={
                  item.highlight
                    ? "whitespace-nowrap pb-1 font-semibold text-price-sale hover:underline"
                    : item.active
                      ? "whitespace-nowrap border-b-2 border-sage pb-1 text-sage"
                      : "whitespace-nowrap pb-1 hover:text-sage"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream pb-16 pt-10">
        <div className="mx-auto max-w-store px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_0.9fr] lg:gap-16">
            <div>
              <h2 className="font-display text-center text-3xl tracking-[0.2em] md:text-4xl">
                BEST SELLERS
              </h2>
              <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
                {bestsellers.map((p) => (
                  <ProductCard key={p.id} product={p} variant="editorial" />
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-display text-center text-3xl tracking-[0.2em] md:text-4xl">
                NEW ARRIVALS
              </h2>
              <ul className="mt-10 space-y-6">
                {newest.map((p) => {
                  const img = (() => {
                    try {
                      const parsed = JSON.parse(p.images);
                      return Array.isArray(parsed) && parsed[0] ? parsed[0] : "/products/placeholder.jpg";
                    } catch {
                      return "/products/placeholder.jpg";
                    }
                  })();
                  return (
                    <li key={p.id} className="flex gap-4 border-b border-border/70 pb-6">
                      <Link
                        href={`/products/${p.slug}`}
                        className="relative h-20 w-20 shrink-0 overflow-hidden bg-[#f6f1ea]"
                      >
                        <Image
                          src={img}
                          alt={p.title}
                          fill
                          sizes="80px"
                          quality={90}
                          className="object-cover"
                        />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <Link
                          href={`/products/${p.slug}`}
                          className="font-display text-sm uppercase tracking-wide hover:underline"
                        >
                          {p.title}
                        </Link>
                        <p className="mt-1 font-display text-foreground/70">
                          {new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits: 0,
                          }).format(p.sellingPrice)}
                        </p>
                        <Link
                          href={`/products/${p.slug}`}
                          className="mt-2 text-xs underline underline-offset-4"
                        >
                          Add to Cart
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-sage py-16 text-white">
        <div className="mx-auto max-w-store px-4 md:px-6">
          <h2 className="font-display text-center text-3xl tracking-[0.18em] md:text-4xl">
            EXPLORE OUR COLLECTIONS
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {[
              { label: "Hair Care", href: "/products?category=Hair+Serum", image: "/hero/green-leaves.jpg" },
              { label: "Face Essentials", href: "/products?category=Face+Essential", image: "/collections/pink-flower.jpg" },
              { label: "Fragrance", href: "/products?category=Perfume", image: "/collections/flower-buds.jpg" },
            ].map((c) => (
              <Link key={c.label} href={c.href} className="group flex flex-col items-center gap-4">
                <div className="relative aspect-square w-44 overflow-hidden rounded-full ring-2 ring-white/30 transition duration-300 group-hover:scale-105 md:w-52">
                  <Image
                    src={c.image}
                    alt={c.label}
                    fill
                    sizes="208px"
                    quality={90}
                    className="object-cover"
                  />
                </div>
                <span className="font-display text-xl tracking-wide">{c.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
