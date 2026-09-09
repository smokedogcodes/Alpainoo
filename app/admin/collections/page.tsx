import { requireScreenView } from "@/lib/auth/require-screen";
import Link from "next/link";
import {
  listCollections,
  createCollectionAction,
  getCollectionBySlug,
} from "@/lib/actions/collections";
import { listAdminProducts } from "@/lib/db/products";
import { CollectionListItem } from "@/components/admin/collection-list-item";
import { AdminForm, AdminFormActions } from "@/components/admin/admin-form";
import { FieldLabel, RequiredHint } from "@/components/admin/field-label";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function AdminCollectionsPage() {
  await requireScreenView("collections");
  const [collections, products] = await Promise.all([
    listCollections(),
    listAdminProducts().catch(() => []),
  ]);

  const productOptions = products.map((p) => ({ id: p.id, title: p.title }));

  const details = await Promise.all(
    collections.map(async (c) => {
      const detail = await getCollectionBySlug(c.slug);
      return {
        collection: c,
        selectedProductIds: detail?.productIds || [],
      };
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Collections</h1>
        <p className="mt-1 text-sm text-muted">
          Curated sets shown on the shop at{" "}
          <Link href="/collections" className="text-sage underline">
            /collections
          </Link>
          .
        </p>
      </div>

      <AdminForm
        action={createCollectionAction}
        successMessage="Collection created successfully"
        errorMessage="Could not create collection"
        resetOnSuccess
        className="max-w-xl space-y-3 rounded-lg border border-border bg-white p-4"
      >
        <h2 className="font-display text-xl">Add collection</h2>
        <RequiredHint />
        <div>
          <FieldLabel htmlFor="name" required>
            Name
          </FieldLabel>
          <Input id="name" name="name" required placeholder="Summer Essentials" className="mt-1.5" />
        </div>
        <div>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Input id="description" name="description" className="mt-1.5" />
        </div>
        <ImageUploadField name="coverImage" id="coverImage" />
        <AdminFormActions>
          <Button type="submit">Create</Button>
        </AdminFormActions>
      </AdminForm>

      <ul className="space-y-6">
        {details.map(({ collection: c, selectedProductIds }) => (
          <CollectionListItem
            key={c.id}
            collection={{
              id: c.id,
              name: c.name,
              slug: c.slug,
              description: c.description,
              coverImage: c.coverImage,
            }}
            selectedProductIds={selectedProductIds}
            productOptions={productOptions}
          />
        ))}
        {!collections.length && (
          <li className="rounded-lg border border-border bg-white px-4 py-3 text-sm text-muted">
            No collections yet.
          </li>
        )}
      </ul>
    </div>
  );
}
