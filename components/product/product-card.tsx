"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useCardTilt } from "@/hooks/use-storefront-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/product/product-image";
import { useCart } from "@/lib/cart";
import { formatINR, parseJsonArray, cn } from "@/lib/utils";

export type ProductCardData = {
  id: string;
  title: string;
  slug: string;
  brand: string;
  mrp: number;
  sellingPrice: number;
  discount: number;
  stock: number;
  rating: number;
  images: string;
};

export function ProductCard({
  product,
  variant = "shop",
}: {
  product: ProductCardData;
  variant?: "shop" | "editorial";
}) {
  const addItem = useCart((s) => s.addItem);
  const images = parseJsonArray(product.images);
  const onSale = product.discount > 0;
  const cover = images[0] || "/products/placeholder.jpg";
  const editorial = variant === "editorial";
  const tilt = useCardTilt(editorial);

  function add() {
    if (product.stock <= 0) {
      toast.error("Out of stock");
      return;
    }
    addItem({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      price: product.sellingPrice,
      image: cover,
      stock: product.stock,
    });
    toast.success("Added to cart");
  }

  return (
    <motion.article {...tilt} className={cn("group flex flex-col", editorial ? "storefront-tilt" : "transition-transform duration-300 hover:-translate-y-1")}>
      <Link
        href={`/products/${product.slug}`}
        className={cn(
          "relative block overflow-hidden aspect-square transition-shadow duration-300 group-hover:shadow-[0_12px_30px_-12px_rgba(84,95,75,0.25)]",
          editorial ? "bg-[#f6f1ea]" : "rounded-lg bg-blush-soft"
        )}
      >
        <ProductImage
          src={cover}
          alt={product.title}
          fill
          sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
          className="transition duration-500 group-hover:scale-[1.05]"
        />
        {!editorial && onSale && (
          <span className="absolute right-2 top-2 z-10 rounded bg-sale px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            On Sale
          </span>
        )}
      </Link>
      <div className={cn("mt-3 flex flex-1 flex-col", editorial ? "items-center text-center gap-1.5" : "gap-1")}>
        <Link
          href={`/products/${product.slug}`}
          className={cn(
            "leading-snug hover:underline",
            editorial
              ? "font-display text-sm uppercase tracking-[0.08em] md:text-base"
              : "font-medium"
          )}
        >
          {product.title}
        </Link>
        <div className={cn("flex items-baseline gap-2", editorial && "justify-center")}>
          <span className={cn(editorial ? "font-display text-base text-foreground/80" : "font-semibold text-price-sale")}>
            {formatINR(product.sellingPrice)}
          </span>
          {!editorial && onSale && (
            <span className="text-sm text-muted line-through">{formatINR(product.mrp)}</span>
          )}
        </div>
        <Button
          onClick={add}
          className={cn("storefront-elevate mt-auto w-full", editorial && "mt-3 border-foreground/70")}
          size="sm"
          variant={editorial ? "outline" : "default"}
          disabled={product.stock <= 0}
        >
          {product.stock <= 0 ? "Out of stock" : "Add to Cart"}
        </Button>
      </div>
    </motion.article>
  );
}
