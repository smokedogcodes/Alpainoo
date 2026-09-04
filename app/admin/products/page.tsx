import Link from "next/link";
import { listAdminProducts } from "@/lib/db/products";
import { formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductAdminActions } from "@/components/admin/product-actions";

export default async function AdminProductsPage() {
  const products = await listAdminProducts();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl">Products</h1>
        <Button asChild>
          <Link href="/admin/products/new">Add product</Link>
        </Button>
      </div>
      <div className="space-y-3 lg:hidden">
        {products.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-muted">
                  {p.sku} · {p.brand}
                </p>
              </div>
              {p.isHidden && <Badge variant="muted">Hidden</Badge>}
            </div>
            <p className="mt-2 text-sm">
              {formatINR(p.sellingPrice)} · Stock {p.stock}
            </p>
            <ProductAdminActions product={p} />
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-white lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-off-white">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">SKU</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-border">
                <td className="p-3">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-muted">{p.brand}</p>
                </td>
                <td className="p-3">{p.sku}</td>
                <td className="p-3">{formatINR(p.sellingPrice)}</td>
                <td className="p-3">{p.stock}</td>
                <td className="p-3">{p.isHidden ? "Hidden" : "Visible"}</td>
                <td className="p-3">
                  <ProductAdminActions product={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
