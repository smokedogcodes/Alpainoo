"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldLabel, RequiredHint } from "@/components/admin/field-label";
import { AdminFormActions } from "@/components/admin/admin-form";
import { addVariant, deleteVariant, type VariantItem } from "@/lib/actions/variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VariantManager({
  productId,
  initialVariants,
}: {
  productId: string;
  initialVariants: VariantItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [variants, setVariants] = useState(initialVariants);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    scent: "",
    size: "",
    stock: "0",
  });

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const created = await addVariant({
          productId,
          name: form.name,
          sku: form.sku,
          scent: form.scent || undefined,
          size: form.size || undefined,
          stock: Number(form.stock) || 0,
        });
        setVariants((prev) => [
          ...prev,
          {
            id: created.id,
            productId,
            name: form.name,
            sku: form.sku,
            scent: form.scent || null,
            size: form.size || null,
            mrp: null,
            sellingPrice: null,
            stock: Number(form.stock) || 0,
          },
        ]);
        setForm({ name: "", sku: "", scent: "", size: "", stock: "0" });
        toast.success("Variant added");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add variant");
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteVariant(id, productId);
        setVariants((prev) => prev.filter((v) => v.id !== id));
        toast.success("Variant removed");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h2 className="font-display text-xl">Variants</h2>
      <p className="mt-1 text-sm text-muted">Size, scent, or SKU variants for this product.</p>

      <ul className="mt-4 divide-y divide-border text-sm">
        {variants.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 py-2">
            <div>
              <p className="font-medium">
                {v.name}
                {v.size ? ` · ${v.size}` : ""}
                {v.scent ? ` · ${v.scent}` : ""}
              </p>
              <p className="text-xs text-muted">
                SKU {v.sku} · stock {v.stock}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => onDelete(v.id)}
            >
              Delete
            </Button>
          </li>
        ))}
        {!variants.length && <li className="py-2 text-muted">No variants yet.</li>}
      </ul>

      <form onSubmit={onAdd} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <RequiredHint />
        </div>
        <div>
          <FieldLabel htmlFor="variantName" required>
            Name
          </FieldLabel>
          <Input
            id="variantName"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1.5"
            placeholder="30ml Rose"
          />
        </div>
        <div>
          <FieldLabel htmlFor="variantSku" required>
            SKU
          </FieldLabel>
          <Input
            id="variantSku"
            required
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            className="mt-1.5"
          />
        </div>
        <div>
          <FieldLabel htmlFor="variantSize">Size</FieldLabel>
          <Input
            id="variantSize"
            value={form.size}
            onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
            className="mt-1.5"
          />
        </div>
        <div>
          <FieldLabel htmlFor="variantScent">Scent</FieldLabel>
          <Input
            id="variantScent"
            value={form.scent}
            onChange={(e) => setForm((f) => ({ ...f, scent: e.target.value }))}
            className="mt-1.5"
          />
        </div>
        <div>
          <FieldLabel htmlFor="variantStock">Stock</FieldLabel>
          <Input
            id="variantStock"
            type="number"
            min={0}
            value={form.stock}
            onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
            className="mt-1.5"
          />
        </div>
        <AdminFormActions className="flex items-end sm:col-span-2">
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            Add variant
          </Button>
        </AdminFormActions>
      </form>
    </div>
  );
}
