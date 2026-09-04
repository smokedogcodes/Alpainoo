"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const FALLBACK = "/products/placeholder.jpg";

export function ProductImage({
  src,
  alt,
  className,
  fill,
  sizes = "100vw",
  priority,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
}) {
  const imageSrc = src && src.trim() ? src : FALLBACK;
  // D1/R2 served via API — skip CF image optimizer (quality/path quirks)
  const unoptimized =
    imageSrc.startsWith("/api/media/") || imageSrc.startsWith("/api/uploads/");

  if (fill) {
    return (
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={75}
        unoptimized={unoptimized}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={800}
      height={800}
      sizes={sizes}
      priority={priority}
      quality={75}
      unoptimized={unoptimized}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
