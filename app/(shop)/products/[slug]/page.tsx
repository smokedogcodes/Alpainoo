import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Leaf } from "lucide-react";
import { auth } from "@/auth";
import { getProductBySlug } from "@/lib/db/products";
import { formatINR, parseJsonArray } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { PincodeChecker } from "@/components/product/pincode-checker";
import { ProductGallery } from "@/components/product/product-gallery";
import { ReviewForm } from "@/components/product/review-form";
import { WishlistButton } from "@/components/product/wishlist-button";
import { listApprovedReviews } from "@/lib/actions/reviews";
import { isInWishlist } from "@/lib/actions/wishlist";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);
  if (!product || product.isHidden) return { title: "Product" };
  return {
    title: product.metaTitle || product.title,
    description: product.metaDescription || product.description.slice(0, 160),
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const product = await getProductBySlug(params.slug);
  if (!product || product.isHidden) notFound();

  const benefits = parseJsonArray(product.benefits);
  const images = parseJsonArray(product.images);
  const session = await auth();
  const [reviews, wished] = await Promise.all([
    listApprovedReviews(product.id),
    isInWishlist(product.id),
  ]);

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://alpainoo.com").replace(/\/$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.metaDescription || product.description,
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand },
    image: images.map((src) => (src.startsWith("http") ? src : `${baseUrl}${src}`)),
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.sellingPrice,
      availability:
        product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${baseUrl}/products/${product.slug}`,
    },
    aggregateRating:
      product.reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          }
        : undefined,
  };

  return (
    <div className="mx-auto max-w-store px-4 py-8 pb-28 md:px-6 lg:pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery title={product.title} images={images} brand={product.brand} />
        <div>
          <p className="text-sm uppercase tracking-wide text-sage">{product.brand}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold md:text-4xl">{product.title}</h1>
          {product.volume && <p className="mt-1 text-sm text-muted">{product.volume}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-2xl font-semibold">{formatINR(product.sellingPrice)}</span>
            {product.discount > 0 && (
              <>
                <span className="text-muted line-through">{formatINR(product.mrp)}</span>
                <Badge className="bg-terracotta text-white">On Sale</Badge>
              </>
            )}
          </div>
          <p className="mt-2 text-sm">
            {product.stock > 0 ? (
              <span className="text-sale">In stock ({product.stock})</span>
            ) : (
              <span className="text-price-sale">Out of stock</span>
            )}
          </p>
          <ul className="mt-6 space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex gap-2 text-sm">
                <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 space-y-4">
            <AddToCartButton product={product} />
            <WishlistButton productId={product.id} initialWished={wished} />
            <PincodeChecker />
          </div>
        </div>
      </div>

      <Tabs defaultValue="ingredients" className="mt-12">
        <TabsList>
          <TabsTrigger value="ingredients">
            <Leaf className="mr-1 h-3.5 w-3.5" /> Ingredients
          </TabsTrigger>
          <TabsTrigger value="usage">
            <Leaf className="mr-1 h-3.5 w-3.5" /> How to Use
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <Leaf className="mr-1 h-3.5 w-3.5" /> Reviews
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ingredients">
          <p className="max-w-3xl text-sm leading-relaxed text-foreground/90">
            {product.ingredients || "Ingredients coming soon."}
          </p>
        </TabsContent>
        <TabsContent value="usage">
          <p className="max-w-3xl text-sm leading-relaxed">{product.usage || "Usage instructions coming soon."}</p>
        </TabsContent>
        <TabsContent value="reviews">
          <p className="text-sm text-muted">
            Rated {product.rating.toFixed(1)} / 5 from {product.reviewCount} reviews.
          </p>
          <ul className="mt-4 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-md border border-border bg-cream p-4 text-sm">
                <p className="font-medium">
                  {r.author} · {r.rating}/5
                </p>
                {r.title && <p className="mt-1 text-sage">{r.title}</p>}
                <p className="mt-2 text-foreground/90">{r.body}</p>
              </li>
            ))}
            {!reviews.length && (
              <li className="text-sm text-muted">No approved reviews yet.</li>
            )}
          </ul>
          <ReviewForm
            productId={product.id}
            defaultAuthor={session?.user?.name || session?.user?.email?.split("@")[0] || ""}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
