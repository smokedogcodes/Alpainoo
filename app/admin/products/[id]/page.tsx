import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { VariantManager } from "@/components/admin/variant-manager";
import { listVariants } from "@/lib/actions/variants";
import { getProductById } from "@/lib/db/products";
import { asD1, getD1, toDate } from "@/lib/db/d1";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const product = await getProductById(params.id);
  if (!product) notFound();

  const variants = await listVariants(product.id);

  let stockLogs: { id: string; change: number; note: string | null; createdAt: Date }[] = [];
  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(
        `SELECT id, change, note, createdAt FROM StockLog WHERE productId = ? ORDER BY createdAt DESC LIMIT 10`
      )
      .bind(product.id)
      .all();
    stockLogs = ((res.results || []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      change: Number(r.change),
      note: r.note != null ? String(r.note) : null,
      createdAt: toDate(r.createdAt),
    }));
  } else {
    try {
      const { getPrismaAsync } = await import("@/lib/prisma");
      const prisma = await getPrismaAsync();
      stockLogs = await prisma.stockLog.findMany({
        where: { productId: product.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    } catch {
      stockLogs = [];
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl">Edit product</h1>
      <ProductForm
        product={{
          id: product.id,
          title: product.title,
          brand: product.brand,
          category: product.category,
          description: product.description,
          volume: product.volume,
          mrp: product.mrp,
          sellingPrice: product.sellingPrice,
          stock: product.stock,
          sku: product.sku,
          ingredients: product.ingredients,
          usage: product.usage,
          benefits: product.benefits,
          images: product.images,
          metaTitle: product.metaTitle,
          metaDescription: product.metaDescription,
          lowStockThreshold: product.lowStockThreshold,
        }}
      />
      <VariantManager productId={product.id} initialVariants={variants} />
      <div className="rounded-lg border border-border bg-white p-4">
        <h2 className="font-display text-xl">Stock ledger</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {stockLogs.map((log) => (
            <li key={log.id} className="flex justify-between gap-3 py-2">
              <span>
                {log.change > 0 ? "+" : ""}
                {log.change} · {log.note || "—"}
              </span>
              <span className="text-muted">{log.createdAt.toLocaleString()}</span>
            </li>
          ))}
          {!stockLogs.length && <li className="py-2 text-muted">No stock changes yet.</li>}
        </ul>
      </div>
    </div>
  );
}
