import { listCategories } from "@/lib/actions/categories";
import { createCategoryAction } from "@/lib/actions/admin-marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function AdminCategoriesPage() {
  const categories = await listCategories();

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl">Categories</h1>

      <form
        action={createCategoryAction}
        className="max-w-xl space-y-3 rounded-lg border border-border bg-white p-4"
      >
        <h2 className="font-display text-xl">Add category</h2>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="Hair Serum" />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" />
        </div>
        <div>
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={0} min={0} />
        </div>
        <Button type="submit">Create</Button>
      </form>

      <ul className="divide-y divide-border rounded-lg border border-border bg-white">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted">/{c.slug}</p>
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
