import Image from "next/image";
import Link from "next/link";
import { listProducts } from "@/lib/db/products";
import { ProductCard } from "@/components/product/product-card";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import { HeroOrb } from "@/components/motion/hero-orb";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/fade-in";
import { parseJsonArray, formatINR } from "@/lib/utils";

export default async function HomePage() {
  const [bestsellers, newest] = await Promise.all([
    listProducts({ orderBy: "reviewCount", orderDir: "desc", take: 4 }),
    listProducts({ orderBy: "createdAt", orderDir: "desc", take: 4 }),
  ]);

  return (
    <>
      <section className="relative isolate min-h-[78vh] overflow-hidden bg-cream md:min-h-[90vh]">
        <Image
          src="/hero/green-leaves.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="pointer-events-none object-cover object-center opacity-40 animate-slow-zoom"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-cream/70 via-cream/50 to-cream" />

        <div className="relative z-10 mx-auto flex min-h-[78vh] max-w-store flex-col items-center justify-center px-4 py-24 text-center md:min-h-[90vh] md:px-6">
          <HeroOrb>
            <div className="ambient-shadow flex h-60 w-60 flex-col items-center justify-center rounded-full bg-blush px-7 md:h-[19.5rem] md:w-[19.5rem] md:px-10">
              <p className="font-display text-2xl italic font-normal tracking-wide text-foreground/75 md:text-[1.75rem]">
                Alpainoo
              </p>
              <h1 className="mt-2 font-display text-[1.35rem] font-medium leading-snug tracking-wide text-foreground md:text-[1.85rem] text-balance">
                Your Ultimate Online Skincare Destination
              </h1>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="mt-5 rounded-full border-sage/70 bg-cream/60 px-9 tracking-widest transition-transform hover:scale-[1.03] hover:bg-cream"
              >
                <Link href="/products">Shop Now</Link>
              </Button>
            </div>
          </HeroOrb>
        </div>
      </section>

      <section className="border-b border-border/40 bg-cream">
        <div className="mx-auto max-w-store px-4 py-3.5 md:px-6">
          <div className="flex justify-center gap-8 overflow-x-auto text-xs font-semibold uppercase tracking-widest text-muted">
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
                    ? "whitespace-nowrap pb-1 text-price-sale transition-colors hover:underline"
                    : item.active
                      ? "whitespace-nowrap border-b-2 border-sage pb-1 text-sage"
                      : "whitespace-nowrap pb-1 transition-colors hover:text-sage"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface-low pb-16 pt-10">
        <div className="mx-auto max-w-store px-4 md:px-6">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_0.9fr] lg:gap-16">
            <FadeIn>
              <h2 className="font-display text-center text-3xl font-medium tracking-[0.12em] text-sage md:text-4xl">
                BEST SELLERS
              </h2>
              <Stagger className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2" delay={0.1}>
                {bestsellers.map((p) => (
                  <StaggerItem key={p.id}>
                    <ProductCard product={p} variant="editorial" />
                  </StaggerItem>
                ))}
              </Stagger>
            </FadeIn>
            <FadeIn delay={0.12}>
              <h2 className="font-display text-center text-3xl font-medium tracking-[0.12em] text-sage md:text-4xl">
                NEW ARRIVALS
              </h2>
              <ul className="mt-10 space-y-6">
                {newest.map((p, i) => {
                  const img = parseJsonArray(p.images)[0] || "/products/placeholder.jpg";
                  return (
                    <FadeIn key={p.id} delay={0.05 * i} y={12}>
                      <li className="flex gap-4 border-b border-border/50 pb-6 transition-colors hover:border-sage/40">
                        <Link
                          href={`/products/${p.slug}`}
                          className="relative h-20 w-20 shrink-0 overflow-hidden bg-surface-container transition-transform hover:scale-[1.03]"
                        >
                          <ProductImage
                            src={img}
                            alt={p.title}
                            fill
                            sizes="80px"
                          />
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                          <Link
                            href={`/products/${p.slug}`}
                            className="font-display text-sm uppercase tracking-wide text-sage hover:underline"
                          >
                            {p.title}
                          </Link>
                          <p className="text-sm text-muted">{formatINR(p.sellingPrice)}</p>
                          <Link
                            href={`/products/${p.slug}`}
                            className="mt-1 text-xs uppercase tracking-widest underline underline-offset-4"
                          >
                            Add to Cart
                          </Link>
                        </div>
                      </li>
                    </FadeIn>
                  );
                })}
              </ul>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="bg-sage py-16 text-white">
        <div className="mx-auto max-w-store px-4 md:px-6">
          <FadeIn>
            <h2 className="font-display text-center text-3xl font-medium tracking-[0.12em] md:text-4xl">
              EXPLORE OUR COLLECTIONS
            </h2>
          </FadeIn>
          <Stagger className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3" delay={0.15}>
            {[
              { label: "Hair Care", href: "/products?category=Hair+Serum", image: "/hero/green-leaves.jpg" },
              { label: "Face Essentials", href: "/products?category=Face+Essential", image: "/collections/pink-flower.jpg" },
              { label: "Fragrance", href: "/products?category=Perfume", image: "/collections/flower-buds.jpg" },
            ].map((c) => (
              <StaggerItem key={c.label}>
                <Link href={c.href} className="group flex flex-col items-center gap-4">
                  <div className="relative aspect-square w-44 overflow-hidden rounded-full ring-2 ring-white/30 transition duration-500 group-hover:scale-105 group-hover:ring-white/60 md:w-52">
                    <Image
                      src={c.image}
                      alt={c.label}
                      fill
                      sizes="208px"
                      quality={75}
                      className="object-cover transition duration-700 group-hover:scale-110"
                    />
                  </div>
                  <span className="font-display text-xl tracking-wide transition-transform group-hover:translate-y-0.5">
                    {c.label}
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
    </>
  );
}
