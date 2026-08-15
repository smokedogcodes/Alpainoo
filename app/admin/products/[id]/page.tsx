import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/product-form";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { stockLogs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!product) notFound();

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl">Edit product</h1>
      <ProductForm product={product} />
      <div className="rounded-lg border border-border bg-white p-4">
        <h2 className="font-display text-xl">Stock ledger</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {product.stockLogs.map((log) => (
            <li key={log.id} className="flex justify-between gap-3 py-2">
              <span>
                {log.change > 0 ? "+" : ""}
                {log.change} · {log.note || "—"}
              </span>
              <span className="text-muted">{log.createdAt.toLocaleString()}</span>
            </li>
          ))}
          {!product.stockLogs.length && <li className="py-2 text-muted">No stock changes yet.</li>}
        </ul>
      </div>
    </div>
  );
}
