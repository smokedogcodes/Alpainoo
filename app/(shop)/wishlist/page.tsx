import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { listWishlist } from "@/lib/actions/wishlist";
import { ProductCard } from "@/components/product/product-card";
import { opaqueHref } from "@/lib/security/opaque-routes";

export default async function WishlistPage() {
  const user = await requireUser({ callbackPath: opaqueHref("/wishlist") });
  const products = await listWishlist(user.id);

  return (
    <div className="mx-auto max-w-store px-4 py-10 md:px-6">
      <h1 className="font-display text-3xl text-sage md:text-4xl">Wishlist</h1>
      <p className="mt-2 text-sm text-muted">
        Saved products for later.{" "}
        <Link href={opaqueHref("/products")} className="text-sage underline">
          Continue shopping
        </Link>
      </p>

      {products.length === 0 ? (
        <p className="mt-10 text-sm text-muted">Your wishlist is empty.</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
