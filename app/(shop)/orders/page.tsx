import Link from "next/link";
import { formatINR } from "@/lib/utils";
import { requireUser } from "@/lib/auth/require-user";
import { opaqueHref } from "@/lib/security/opaque-routes";
import { listOrdersForUser } from "@/lib/db/orders";

export default async function MyOrdersPage() {
  const user = await requireUser({ callbackPath: opaqueHref("/orders") });

  const orders = await listOrdersForUser(user.id);

  return (
    <div className="mx-auto max-w-store px-4 py-10 md:px-6">
      <h1 className="font-display text-3xl md:text-4xl">My Orders</h1>
      <p className="mt-2 text-sm text-muted">Track shipments and manage cancel requests.</p>

      <div className="mt-8 space-y-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={opaqueHref(`/orders/${o.id}`)}
            className="block rounded-lg border border-border bg-cream p-4 transition-colors hover:border-sage/40"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{o.orderNumber}</p>
                <p className="text-sm text-muted">
                  {o.createdAt.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  · {o.items.length} item{o.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-sm sm:text-right">
                <p className="font-semibold">{formatINR(o.totalAmount)}</p>
                <p className="text-muted">{o.orderStatus}</p>
              </div>
            </div>
          </Link>
        ))}
        {orders.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
            No orders yet.{" "}
            <Link href={opaqueHref("/products")} className="text-sage underline">
              Shop now
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
