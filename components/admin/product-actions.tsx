"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteProduct, toggleHideProduct } from "@/lib/actions/admin";

export function ProductAdminActions({
  product,
}: {
  product: { id: string; isHidden: boolean };
}) {
  const router = useRouter();

  return (
    <div className="mt-3 flex flex-wrap gap-2 lg:mt-0">
      <Button asChild size="sm" variant="outline">
        <Link href={`/admin/products/${product.id}`}>Edit</Link>
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          await toggleHideProduct(product.id, !product.isHidden);
          toast.success(product.isHidden ? "Product visible" : "Product hidden");
          router.refresh();
        }}
      >
        {product.isHidden ? "Unhide" : "Hide"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={async () => {
          if (!confirm("Remove this product?")) return;
          const res = await deleteProduct(product.id);
          toast.success(
            res.soft
              ? "Product has orders — hidden instead of deleted"
              : "Product deleted"
          );
          router.refresh();
        }}
      >
        Delete
      </Button>
    </div>
  );
}
