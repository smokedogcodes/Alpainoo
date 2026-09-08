import { requireScreenView } from "@/lib/auth/require-screen";
import Link from "next/link";
import { listCategoriesDb, ensureDefaultCategoriesDb } from "@/lib/db/categories";
import { createCategoryAction } from "@/lib/actions/admin-marketing";
import { AdminForm, AdminFormActions } from "@/components/admin/admin-form";
import { FieldLabel, RequiredHint } from "@/components/admin/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function AdminCategoriesPage() {
  await requireScreenView("categories");
  await ensureDefaultCategoriesDb();
  let categories: Awaited<ReturnType<typeof listCategoriesDb>> = [];
  try {
    categories = await listCategoriesDb();
  } catch (err) {
    console.error("[admin] categories page failed:", err);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Category master</h1>
        <p className="mt-1 text-sm text-muted">
          Categories appear in the product form dropdown.{" "}
          <Link href="/admin/products/new" className="text-sage underline">
            Add a product
          </Link>
        </p>
      </div>

      <AdminForm
        action={createCategoryAction}
        successMessage="Category created successfully"
        errorMessage="Could not create category"
        resetOnSuccess
        className="max-w-xl space-y-3 rounded-lg border border-border bg-white p-4"
      >
        <h2 className="font-display text-xl">Add category</h2>
        <RequiredHint />
        <div>
          <FieldLabel htmlFor="name" required>
            Name
          </FieldLabel>
          <Input id="name" name="name" required placeholder="Hair Serum" className="mt-1.5" />
        </div>
        <div>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Input id="description" name="description" className="mt-1.5" />
        </div>
        <div>
          <FieldLabel htmlFor="sortOrder">Sort order</FieldLabel>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={0}
            min={0}
            className="mt-1.5"
          />
        </div>
        <AdminFormActions>
          <Button type="submit">Create</Button>
        </AdminFormActions>
      </AdminForm>

      <ul className="divide-y divide-border rounded-lg border border-border bg-white">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted">/{c.slug}</p>
              {c.description ? (
                <p className="mt-0.5 text-xs text-muted">{c.description}</p>
              ) : null}
            </div>
            <span className="text-muted">#{c.sortOrder}</span>
          </li>
        ))}
        {!categories.length && (
          <li className="px-4 py-3 text-sm text-muted">No categories yet.</li>
        )}
      </ul>
    </div>
  );
}
