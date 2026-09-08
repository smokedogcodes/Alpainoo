"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteProduct, toggleHideProduct } from "@/lib/actions/admin";
import { Can, useCan } from "@/components/admin/admin-permissions";

export function ProductAdminActions({
  product,
}: {
  product: { id: string; isHidden: boolean };
}) {
  const router = useRouter();
  const canEdit = useCan("products", "edit");
  const canView = useCan("products", "view");

  return (
    <div className="mt-3 flex flex-wrap gap-2 lg:mt-0">
      {canView && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/products/${product.id}`}>{canEdit ? "Edit" : "View"}</Link>
        </Button>
      )}
      <Can screen="products" action="edit">
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await toggleHideProduct(product.id, !product.isHidden);
              toast.success(
                product.isHidden ? "Product is now visible" : "Product hidden successfully"
              );
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not update product");
            }
          }}
        >
          {product.isHidden ? "Unhide" : "Hide"}
        </Button>
      </Can>
      <Can screen="products" action="delete">
        <Button
          size="sm"
          variant="destructive"
          onClick={async () => {
            if (!confirm("Remove this product?")) return;
            try {
              const res = await deleteProduct(product.id);
              toast.success(
                res.soft
                  ? "Product has orders — hidden instead of deleted"
                  : "Product deleted successfully"
              );
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not delete product");
            }
          }}
        >
          Delete
        </Button>
      </Can>
    </div>
  );
}
