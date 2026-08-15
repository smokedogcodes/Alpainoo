"use client";

import { useState } from "react";
import { ProductImage } from "@/components/product/product-image";

export function ProductGallery({
  title,
  images,
}: {
  title: string;
  images: string[];
  brand: string;
}) {
  const slides = images.length ? images : ["/products/placeholder.jpg"];
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-blush-soft">
        <ProductImage
          src={slides[active]}
          alt={title}
          fill
          priority
          sizes="(max-width:1024px) 100vw, 50vw"
        />
      </div>
      {slides.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {slides.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border ${
                i === active ? "border-sage" : "border-border"
              }`}
              aria-label={`Image ${i + 1}`}
            >
              <ProductImage src={src} alt="" fill sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
