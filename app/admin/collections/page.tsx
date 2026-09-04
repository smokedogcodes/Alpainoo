import { listCollections, createCollectionAction } from "@/lib/actions/collections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function AdminCollectionsPage() {
  const collections = await listCollections();

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl">Collections</h1>

      <form
        action={createCollectionAction}
        className="max-w-xl space-y-3 rounded-lg border border-border bg-white p-4"
      >
        <h2 className="font-display text-xl">Add collection</h2>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="Summer Essentials" />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" />
        </div>
        <div>
          <Label htmlFor="coverImage">Cover image URL</Label>
          <Input id="coverImage" name="coverImage" placeholder="/collections/…" />
        </div>
        <Button type="submit">Create</Button>
      </form>

      <ul className="divide-y divide-border rounded-lg border border-border bg-white">
        {collections.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted">/{c.slug}</p>
              {c.description && <p className="mt-1 text-muted">{c.description}</p>}
            </div>
          </li>
        ))}
        {!collections.length && (
          <li className="px-4 py-3 text-sm text-muted">No collections yet.</li>
        )}
      </ul>
    </div>
  );
}
