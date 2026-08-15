import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/utils";

export default async function MyOrdersPage() {
  const session = await auth();
  if (!session?.user?.id && !session?.user?.email) {
    redirect("/?error=login");
  }

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        ...(session.user.id ? [{ userId: session.user.id }] : []),
        ...(session.user.email ? [{ email: session.user.email }] : []),
      ],
    },
    include: { items: true, shipment: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-store px-4 py-10 md:px-6">
      <h1 className="font-display text-3xl md:text-4xl">My Orders</h1>
      <p className="mt-2 text-sm text-muted">Track shipments and manage cancel requests.</p>

      <div className="mt-8 space-y-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
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
              <div className="text-left sm:text-right">
                <p className="font-medium">{formatINR(o.totalAmount)}</p>
                <p className="text-xs uppercase tracking-wide text-muted">{o.orderStatus.replaceAll("_", " ")}</p>
              </div>
            </div>
            {o.shipment?.trackingStatus && (
              <p className="mt-2 text-xs text-muted">Tracking: {o.shipment.trackingStatus}</p>
            )}
          </Link>
        ))}
        {!orders.length && (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-muted">You haven&apos;t placed an order yet.</p>
            <Link href="/products" className="mt-3 inline-block text-sm text-sage underline">
              Browse products
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
