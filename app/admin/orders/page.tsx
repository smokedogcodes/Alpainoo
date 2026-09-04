import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatINR } from "@/lib/utils";
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { AdminOrderActions } from "@/components/admin/admin-order-actions";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireAdmin();

  const where = searchParams.status ? { orderStatus: searchParams.status } : {};
  const orders = await prisma.order.findMany({
    where,
    include: { shipment: true, items: true },
    orderBy: { createdAt: "desc" },
  });

  const statuses = [
    "PENDING",
    "PAID",
    "PROCESSING",
    "CANCEL_REQUESTED",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Orders</h1>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className={`rounded-md px-3 py-2 text-sm ${!searchParams.status ? "bg-sage text-white" : "bg-white border"}`}
        >
          All
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`rounded-md px-3 py-2 text-sm ${
              searchParams.status === s ? "bg-sage text-white" : "bg-white border"
            }`}
          >
            {s.replaceAll("_", " ")}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{o.orderNumber}</p>
                <p className="text-sm text-muted">{o.email}</p>
                <p className="mt-1 text-sm">
                  {formatINR(o.totalAmount)} · {o.items.length} items
                </p>
                {o.orderStatus === "CANCEL_REQUESTED" && (
                  <span className="mt-2 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                    Cancel requested
                  </span>
                )}
              </div>
              <OrderStatusSelect id={o.id} value={o.orderStatus} />
            </div>
            <dl className="mt-3 grid gap-1 text-xs text-muted sm:grid-cols-2">
              <div>Payment: {o.paymentStatus}</div>
              <div>Razorpay: {o.razorpayOrderId || "—"}</div>
              <div>Payment ID: {o.razorpayPaymentId || "—"}</div>
              <div>AWB: {o.shipment?.awbCode || "—"}</div>
              <div>Courier: {o.shipment?.courierName || "—"}</div>
              <div>Tracking: {o.shipment?.trackingStatus || "—"}</div>
            </dl>
            <AdminOrderActions
              orderId={o.id}
              cancelRequested={o.orderStatus === "CANCEL_REQUESTED"}
              cancelReason={o.cancelReason}
              hasShipment={Boolean(o.shipment)}
              canRefund={o.paymentStatus === "PAID"}
            />
          </div>
        ))}
        {!orders.length && <p className="text-muted">No orders found.</p>}
      </div>
    </div>
  );
}
