import { notFound } from "next/navigation";
import { getCollectionBySlug } from "@/lib/actions/collections";
import { getProductById } from "@/lib/db/products";
import { ProductCard } from "@/components/product/product-card";

export default async function CollectionDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const detail = await getCollectionBySlug(params.slug);
  if (!detail) notFound();

  const products = (
    await Promise.all(detail.productIds.map((id) => getProductById(id)))
  ).filter((p): p is NonNullable<typeof p> => Boolean(p) && !p!.isHidden);

  return (
    <div className="mx-auto max-w-store px-4 py-10 md:px-6">
      <h1 className="font-display text-4xl">{detail.collection.name}</h1>
      {detail.collection.description ? (
        <p className="mt-2 max-w-2xl text-muted">{detail.collection.description}</p>
      ) : null}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={{
              id: p.id,
              title: p.title,
              slug: p.slug,
              brand: p.brand,
              mrp: p.mrp,
              sellingPrice: p.sellingPrice,
              discount: p.discount,
              stock: p.stock,
              rating: p.rating,
              images: p.images,
            }}
          />
        ))}
        {!products.length && (
          <p className="text-sm text-muted">No products in this collection yet.</p>
        )}
      </div>
    </div>
  );
}
