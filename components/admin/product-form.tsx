"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertProduct } from "@/lib/actions/admin";
import { parseJsonArray } from "@/lib/utils";

type ProductFormValues = {
  id?: string;
  title?: string;
  brand?: string;
  category?: string;
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
};

export function ProductForm({ product }: { product?: ProductFormValues }) {
  const router = useRouter();
  const benefits = parseJsonArray(product?.benefits).join("\n");
  const [imageUrls, setImageUrls] = useState(parseJsonArray(product?.images).join("\n"));
  const [uploading, setUploading] = useState(false);

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const body = new FormData();
      Array.from(files).forEach((f) => body.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const existing = imageUrls
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const merged = [...existing, ...(data.urls as string[])];
      setImageUrls(merged.join("\n"));
      toast.success(`Uploaded ${data.urls.length} image(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      className="mx-auto max-w-2xl space-y-4"
      action={async (fd) => {
        fd.set("images", imageUrls);
        await upsertProduct(fd);
        toast.success(product?.id ? "Product updated" : "Product created");
        router.push("/admin/products");
        router.refresh();
      }}
    >
      {product?.id && <input type="hidden" name="id" value={product.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required defaultValue={product?.title} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" name="brand" required defaultValue={product?.brand} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" required defaultValue={product?.category} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" required defaultValue={product?.sku} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="volume">Volume / size</Label>
          <Input id="volume" name="volume" defaultValue={product?.volume || ""} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="mrp">MRP</Label>
          <Input id="mrp" name="mrp" type="number" required defaultValue={product?.mrp} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="sellingPrice">Selling price</Label>
          <Input
            id="sellingPrice"
            name="sellingPrice"
            type="number"
            required
            defaultValue={product?.sellingPrice}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="stock">Stock</Label>
          <Input id="stock" name="stock" type="number" required defaultValue={product?.stock ?? 0} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="stockNote">Stock note (optional)</Label>
          <Input id="stockNote" name="stockNote" placeholder="Inventory adjustment" className="mt-1.5" />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" required defaultValue={product?.description} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="benefits">Key benefits (one per line)</Label>
        <Textarea id="benefits" name="benefits" defaultValue={benefits} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="ingredients">Ingredients</Label>
        <Textarea id="ingredients" name="ingredients" defaultValue={product?.ingredients || ""} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="usage">Usage instructions</Label>
        <Textarea id="usage" name="usage" defaultValue={product?.usage || ""} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="fileUpload">Upload product images</Label>
        <Input
          id="fileUpload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          capture="environment"
          className="mt-1.5"
          disabled={uploading}
          onChange={(e) => onUpload(e.target.files)}
        />
        <p className="mt-1 text-xs text-muted">
          Files are stored on the Hostinger server under <code>/uploads/products/</code>
          {uploading ? " — uploading…" : ""}.
        </p>
      </div>
      <div>
        <Label htmlFor="images">Image URLs (one per line)</Label>
        <Textarea
          id="images"
          name="images"
          value={imageUrls}
          onChange={(e) => setImageUrls(e.target.value)}
          placeholder="/uploads/products/….jpg"
          className="mt-1.5"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="w-full sm:w-auto" disabled={uploading}>
          Save product
        </Button>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
