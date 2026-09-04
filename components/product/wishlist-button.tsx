"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleWishlist } from "@/lib/actions/wishlist";
import { cn } from "@/lib/utils";

export function WishlistButton({
  productId,
  initialWished = false,
}: {
  productId: string;
  initialWished?: boolean;
}) {
  const [wished, setWished] = useState(initialWished);
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      try {
        const res = await toggleWishlist(productId);
        setWished(res.wished);
        toast.success(res.wished ? "Added to wishlist" : "Removed from wishlist");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Please sign in");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full gap-2"
      disabled={pending}
      onClick={onClick}
      aria-pressed={wished}
    >
      <Heart className={cn("h-4 w-4", wished && "fill-sage text-sage")} />
      {wished ? "In wishlist" : "Add to wishlist"}
    </Button>
  );
}
