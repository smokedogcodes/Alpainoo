import { requireScreenView } from "@/lib/auth/require-screen";
import Link from "next/link";
import {
  listCollections,
  createCollectionAction,
  setCollectionProductsAction,
  getCollectionBySlug,
} from "@/lib/actions/collections";
import { listAdminProducts } from "@/lib/db/products";
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
        <ImageUploadField name="coverImage" id="coverImage" urlPlaceholder="/collections/…" />
        <AdminFormActions>
          <Button type="submit">Create</Button>
        </AdminFormActions>
      </AdminForm>

      <ul className="space-y-6">
        {await Promise.all(
          collections.map(async (c) => {
            const detail = await getCollectionBySlug(c.slug);
            const selected = new Set(detail?.productIds || []);
            return (
              <li key={c.id} className="rounded-lg border border-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted">
                      /collections/{c.slug} · {selected.size} product(s)
                    </p>
                    {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}
                  </div>
                  <Link href={`/collections/${c.slug}`} className="text-sm text-sage underline">
                    View shop page
                  </Link>
                </div>
                <AdminForm
                  action={setCollectionProductsAction}
                  successMessage="Collection products saved"
                  errorMessage="Could not save products"
                  className="mt-4 space-y-2"
                >
                  <input type="hidden" name="collectionId" value={c.id} />
                  <FieldLabel htmlFor={`products-${c.id}`}>Products in collection</FieldLabel>
                  <select
                    id={`products-${c.id}`}
                    name="productIds"
                    multiple
                    className="h-40 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                    defaultValue={Array.from(selected)}
                  >
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted">Hold Ctrl/Cmd to select multiple products.</p>
                  <AdminFormActions>
                    <Button type="submit" size="sm">
                      Save products
                    </Button>
                  </AdminFormActions>
                </AdminForm>
              </li>
            );
          })
        )}
        {!collections.length && (
          <li className="rounded-lg border border-border bg-white px-4 py-3 text-sm text-muted">
            No collections yet.
          </li>
        )}
      </ul>
    </div>
  );
}
