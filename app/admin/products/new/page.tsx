import { requireScreenView } from "@/lib/auth/require-screen";
import { requirePermission } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { ensureDefaultCategoriesDb } from "@/lib/db/categories";

export default async function NewProductPage() {
  await requireScreenView("products");
  try {
    await requirePermission("products", "edit");
  } catch {
    redirect("/admin/products");
  }

  let categories: Awaited<ReturnType<typeof ensureDefaultCategoriesDb>> = [];
  try {
    categories = await ensureDefaultCategoriesDb();
  } catch (err) {
    console.error("[admin/products/new] load categories failed:", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Add product</h1>
        <p className="mt-1 text-sm text-muted">
          Required fields are marked with *. SKU is optional (auto-generated if blank).
        </p>
      </div>
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
      />
    </div>
  );
}
