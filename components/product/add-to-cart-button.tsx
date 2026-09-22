"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatINR, parseJsonArray } from "@/lib/utils";
import type { VariantItem } from "@/lib/actions/variants";

type Product = {
  id: string;
  title: string;
  slug: string;
  sellingPrice: number;
  stock: number;
  images: string;
};

export function AddToCartButton({
  product,
  variants = [],
}: {
  product: Product;
  variants?: VariantItem[];
}) {
  const addItem = useCart((s) => s.addItem);
  const images = parseJsonArray(product.images);
  const [variantId, setVariantId] = useState(variants[0]?.id || "");

  const selected = useMemo(
    () => variants.find((v) => v.id === variantId) || null,
    [variants, variantId]
  );

  const price = selected?.sellingPrice ?? product.sellingPrice;
  const stock = selected ? selected.stock : product.stock;
  const title = selected ? `${product.title} — ${selected.name}` : product.title;

  function add() {
    if (variants.length > 0 && !selected) {
      toast.error("Select a variant");
      return;
    }
    if (stock <= 0) {
      toast.error("Out of stock");
      return;
    }
    addItem({
      productId: product.id,
      variantId: selected?.id,
      slug: product.slug,
      title,
      price,
      image: images[0] || "",
      stock,
    });
    toast.success("Added to cart");
  }

  return (
    <div className="space-y-3">
      {variants.length > 0 ? (
        <div>
          <label htmlFor="variant" className="text-sm font-medium">
            Option
          </label>
          <select
            id="variant"
            className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                {v.name}
                {v.size ? ` · ${v.size}` : ""}
                {v.scent ? ` · ${v.scent}` : ""} — {formatINR(v.sellingPrice ?? product.sellingPrice)}
                {v.stock <= 0 ? " (out of stock)" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            {stock > 0 ? `${stock} in stock` : "Out of stock"}
          </p>
        </div>
      ) : null}

      <Button
        size="lg"
        className="storefront-elevate hidden w-full lg:inline-flex"
        disabled={stock <= 0}
        onClick={add}
      >
        Add to Cart · {formatINR(price)}
      </Button>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-cream p-3 safe-pb lg:hidden">
        <Button size="lg" className="w-full" disabled={stock <= 0} onClick={add}>
          Add to Cart · {formatINR(price)}
        </Button>
      </div>
    </div>
  );
}
