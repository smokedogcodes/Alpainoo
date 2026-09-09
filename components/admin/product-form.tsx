"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminFormActions } from "@/components/admin/admin-form";
import { FieldLabel, RequiredHint } from "@/components/admin/field-label";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { upsertProduct } from "@/lib/actions/products";
import { parseJsonArray } from "@/lib/utils";
import { DEFAULT_CATEGORY_NAMES } from "@/lib/constants/categories";
import { useCan } from "@/components/admin/admin-permissions";

export type CategoryOption = { id: string; name: string; slug: string };

type ProductFormValues = {
  id?: string;
  title?: string;
  brand?: string;
  category?: string;
  categoryId?: string | null;
  description?: string;
  volume?: string | null;
  mrp?: number;
  sellingPrice?: number;
  stock?: number;
  sku?: string;
  ingredients?: string | null;
  usage?: string | null;
  benefits?: string;
  images?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  lowStockThreshold?: number | null;
};

export function ProductForm({
  product,
  categories = [],
}: {
  product?: ProductFormValues;
  categories?: CategoryOption[];
}) {
  const router = useRouter();
  const canEdit = useCan("products", "edit");
  const benefits = parseJsonArray(product?.benefits).join("\n");
  const [imageUrls, setImageUrls] = useState(parseJsonArray(product?.images).join("\n"));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  /** Always a dropdown — merge DB categories with built-in defaults so the UI never falls back to free text. */
  const categoryOptions = useMemo(() => {
    const byName = new Map<string, CategoryOption>();
    for (const c of categories) {
      byName.set(c.name.toLowerCase(), c);
    }
    for (const name of DEFAULT_CATEGORY_NAMES) {
      const key = name.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, { id: `fallback:${slugSafe(name)}`, name, slug: slugSafe(name) });
      }
    }
    if (product?.category && !byName.has(product.category.toLowerCase())) {
      byName.set(product.category.toLowerCase(), {
        id: `existing:${product.category}`,
        name: product.category,
        slug: slugSafe(product.category),
      });
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, product?.category]);

  const defaultCategory =
    product?.category ||
    categories.find((c) => c.id === product?.categoryId)?.name ||
    categoryOptions[0]?.name ||
    "";

  return (
    <form
      className="mx-auto max-w-2xl space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const fd = new FormData(e.currentTarget);
          const str = (name: string) => String(fd.get(name) || "");
          const num = (name: string) => Number(str(name) || 0);
          const result = await upsertProduct({
            id: product?.id,
            title: str("title"),
            brand: str("brand"),
            category: str("category"),
            description: str("description"),
            volume: str("volume"),
            mrp: num("mrp"),
            sellingPrice: num("sellingPrice"),
            stock: num("stock"),
            sku: str("sku"),
            ingredients: str("ingredients"),
            usage: str("usage"),
            benefits: str("benefits"),
            images: imageUrls,
            stockNote: str("stockNote") || undefined,
            metaTitle: str("metaTitle") || undefined,
            metaDescription: str("metaDescription") || undefined,
            lowStockThreshold: str("lowStockThreshold")
              ? Number(str("lowStockThreshold"))
              : undefined,
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(product?.id ? "Product updated successfully" : "Product created successfully");
          router.push("/admin/products");
          router.refresh();
        } catch (err) {
          const msg =
            err instanceof Error &&
            err.message &&
            !/Server Components render|digest/i.test(err.message)
              ? err.message
              : "Could not save product — please refresh and try again";
          toast.error(msg);
        } finally {
          setSaving(false);
        }
      }}
    >
      {product?.id && <input type="hidden" name="id" value={product.id} />}

      <RequiredHint />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="title" required>
            Title
          </FieldLabel>
          <Input id="title" name="title" required defaultValue={product?.title} className="mt-1.5" />
        </div>

        <div>
          <FieldLabel htmlFor="category" required>
            Category
          </FieldLabel>
          <select
            id="category"
            name="category"
            required
            defaultValue={defaultCategory}
            className="mt-1.5 flex h-10 w-full appearance-none rounded-md border border-input bg-white bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-10 text-sm"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%235a6b64'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
            }}
          >
            <option value="" disabled>
              Select category
            </option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Choose from Category master.{" "}
            <a href="/admin/categories" className="text-sage underline">
              Manage categories
            </a>
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="brand">Brand</FieldLabel>
          <Input
            id="brand"
            name="brand"
            defaultValue={product?.brand || "Alpainoo"}
            className="mt-1.5"
            placeholder="Alpainoo"
          />
        </div>

        <div>
          <FieldLabel htmlFor="sku">SKU</FieldLabel>
          <Input
            id="sku"
            name="sku"
            defaultValue={product?.sku || ""}
            className="mt-1.5"
            placeholder="Auto-generated if left blank"
          />
        </div>

        <div>
          <FieldLabel htmlFor="volume">Volume / size</FieldLabel>
          <Input id="volume" name="volume" defaultValue={product?.volume || ""} className="mt-1.5" />
        </div>

        <div>
          <FieldLabel htmlFor="mrp" required>
            MRP
          </FieldLabel>
          <Input id="mrp" name="mrp" type="number" required min={1} step="1" defaultValue={product?.mrp} className="mt-1.5" />
        </div>

        <div>
          <FieldLabel htmlFor="sellingPrice" required>
            Selling price
          </FieldLabel>
          <Input
            id="sellingPrice"
            name="sellingPrice"
            type="number"
            required
            min={1}
            step="1"
            defaultValue={product?.sellingPrice}
            className="mt-1.5"
          />
        </div>

        <div>
          <FieldLabel htmlFor="stock" required>
            Stock
          </FieldLabel>
          <Input
            id="stock"
            name="stock"
            type="number"
            required
            min={0}
            step="1"
            defaultValue={product?.stock ?? 0}
            className="mt-1.5"
          />
        </div>

        <div>
          <FieldLabel htmlFor="stockNote">Stock note</FieldLabel>
          <Input id="stockNote" name="stockNote" placeholder="Inventory adjustment" className="mt-1.5" />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea
          id="description"
          name="description"
          defaultValue={product?.description || ""}
          className="mt-1.5"
          placeholder="Optional — defaults to the product title if empty"
        />
      </div>

      <div>
        <FieldLabel htmlFor="benefits">Key benefits (one per line)</FieldLabel>
        <Textarea id="benefits" name="benefits" defaultValue={benefits} className="mt-1.5" />
      </div>

      <div>
        <FieldLabel htmlFor="ingredients">Ingredients</FieldLabel>
        <Textarea
          id="ingredients"
          name="ingredients"
          defaultValue={product?.ingredients || ""}
          className="mt-1.5"
        />
      </div>

      <div>
        <FieldLabel htmlFor="usage">Usage instructions</FieldLabel>
        <Textarea id="usage" name="usage" defaultValue={product?.usage || ""} className="mt-1.5" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="metaTitle">SEO title</FieldLabel>
          <Input
            id="metaTitle"
            name="metaTitle"
            maxLength={120}
            defaultValue={product?.metaTitle || ""}
            className="mt-1.5"
            placeholder="Overrides product title in search results"
          />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="metaDescription">SEO description</FieldLabel>
          <Textarea
            id="metaDescription"
            name="metaDescription"
            maxLength={320}
            defaultValue={product?.metaDescription || ""}
            className="mt-1.5"
          />
        </div>
        <div>
          <FieldLabel htmlFor="lowStockThreshold">Low stock threshold</FieldLabel>
          <Input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            defaultValue={product?.lowStockThreshold ?? 5}
            className="mt-1.5"
          />
        </div>
      </div>

      <ImageUploadField
        name="images"
        id="images"
        multiple
        value={imageUrls}
        onChange={setImageUrls}
        onUploadingChange={setUploading}
      />

      <AdminFormActions className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {canEdit ? (
          <Button type="submit" className="w-full sm:w-auto" disabled={uploading || saving}>
            {saving ? "Saving…" : "Save product"}
          </Button>
        ) : (
          <p className="text-sm text-muted">View only — you cannot edit products.</p>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </AdminFormActions>
    </form>
  );
}

function slugSafe(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
