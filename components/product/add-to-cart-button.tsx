"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { parseJsonArray } from "@/lib/utils";

type Product = {
  id: string;
  title: string;
  slug: string;
  sellingPrice: number;
  stock: number;
  images: string;
};

export function AddToCartButton({ product }: { product: Product }) {
  const addItem = useCart((s) => s.addItem);
  const images = parseJsonArray(product.images);

  return (
    <>
      <Button
        size="lg"
        className="hidden w-full lg:inline-flex"
        disabled={product.stock <= 0}
        onClick={() => {
          addItem({
            productId: product.id,
            slug: product.slug,
            title: product.title,
            price: product.sellingPrice,
            image: images[0] || "",
            stock: product.stock,
          });
          toast.success("Added to cart");
        }}
      >
        Add to Cart
      </Button>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-cream p-3 safe-pb lg:hidden">
        <Button
          size="lg"
          className="w-full"
          disabled={product.stock <= 0}
          onClick={() => {
            addItem({
              productId: product.id,
              slug: product.slug,
              title: product.title,
              price: product.sellingPrice,
              image: images[0] || "",
              stock: product.stock,
            });
            toast.success("Added to cart");
          }}
        >
          Add to Cart
        </Button>
      </div>
    </>
  );
}
