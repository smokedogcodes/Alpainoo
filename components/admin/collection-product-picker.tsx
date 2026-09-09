"use client";

import { useMemo, useState } from "react";
import { setCollectionProductsAction } from "@/lib/actions/collections";
import { AdminForm, AdminFormActions } from "@/components/admin/admin-form";
import { FieldLabel } from "@/components/admin/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProductOption = { id: string; title: string };

export function CollectionProductPicker({
  collectionId,
  productOptions,
  initialSelectedIds,
}: {
  collectionId: string;
  productOptions: ProductOption[];
  initialSelectedIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedIds)
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return productOptions;
    return productOptions.filter((p) => p.title.toLowerCase().includes(q));
  }, [productOptions, query]);

  const selectedTitles = useMemo(() => {
    const byId = new Map(productOptions.map((p) => [p.id, p.title]));
    return Array.from(selected)
      .map((id) => byId.get(id))
      .filter(Boolean) as string[];
  }, [productOptions, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of filtered) next.add(p.id);
      return next;
    });
  }

  function clearVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of filtered) next.delete(p.id);
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  return (
    <AdminForm
      action={async (fd) => {
        // Ensure current checkbox selection is what gets submitted
        fd.delete("productIds");
        for (const id of Array.from(selected)) fd.append("productIds", id);
        await setCollectionProductsAction(fd);
      }}
      successMessage="Collection products saved"
      errorMessage="Could not save products"
      className="mt-4 space-y-3"
    >
      <input type="hidden" name="collectionId" value={collectionId} />

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <FieldLabel htmlFor={`search-${collectionId}`}>Products in collection</FieldLabel>
            <p className="mt-0.5 text-xs text-muted">
              {selected.size} selected
              {selectedTitles.length
                ? ` · ${selectedTitles.slice(0, 3).join(", ")}${selectedTitles.length > 3 ? "…" : ""}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" variant="outline" onClick={selectAllVisible}>
              Select visible
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clearVisible}>
              Clear visible
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clearAll}>
              Clear all
            </Button>
          </div>
        </div>

        <Input
          id={`search-${collectionId}`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products by name…"
          className="max-w-md"
        />
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-cream">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted">No products match your search.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((p) => {
              const checked = selected.has(p.id);
              return (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-white/80">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--sage)]"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                    />
                    <span className={checked ? "font-medium text-foreground" : "text-muted"}>
                      {p.title}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Hidden inputs so form still works if JS path misses append — mirrors state */}
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="productIds" value={id} />
      ))}

      <AdminFormActions>
        <Button type="submit" size="sm">
          Save products
        </Button>
      </AdminFormActions>
    </AdminForm>
  );
}
