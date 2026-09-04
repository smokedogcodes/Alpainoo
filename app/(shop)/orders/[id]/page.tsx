import Link from "next/link";
import { notFound } from "next/navigation";
import { formatINR } from "@/lib/utils";
import { CancelOrderForm } from "@/components/orders/cancel-order-form";
import { ReturnRequestForm } from "@/components/orders/return-request-form";
import { requireUser } from "@/lib/auth/require-user";
import { opaqueHref } from "@/lib/security/opaque-routes";
import { findOrderById } from "@/lib/db/orders";

type Address = {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

const CANCELLABLE = new Set(["PENDING", "PAID", "PROCESSING"]);
const RETURNABLE = new Set(["DELIVERED"]);

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(params.id)) {
    notFound();
  }

  const user = await requireUser({ callbackPath: opaqueHref(`/orders/${params.id}`) });

  const order = await findOrderById(params.id);
  if (
    !order ||
    (order.userId !== user.id && !(user.email && order.email === user.email))
  ) {
    notFound();
  }

  let address: Address = {};
  try {
    address = JSON.parse(order.shippingAddress) as Address;
  } catch {
    address = {};
  }

  const canCancel = CANCELLABLE.has(order.orderStatus);
  const canReturn =
    RETURNABLE.has(order.orderStatus) && order.paymentStatus === "PAID";

  return (
    <div className="mx-auto max-w-store px-4 py-10 md:px-6">
      <Link href={opaqueHref("/orders")} className="text-sm text-sage underline">
        ← My Orders
      </Link>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted">
            Placed{" "}
            {order.createdAt.toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-wide text-muted">Status</p>
          <p className="font-medium">{order.orderStatus.replaceAll("_", " ")}</p>
          <p className="text-sm text-muted">Payment: {order.paymentStatus}</p>
          <Link
            href={opaqueHref(`/orders/${order.id}/invoice`)}
            className="mt-2 inline-block text-sm text-sage underline"
          >
            GST invoice
          </Link>
        </div>
      </div>

      {order.orderStatus === "CANCEL_REQUESTED" && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Cancel request submitted
          {order.cancelReason ? `: ${order.cancelReason}` : "."} Waiting for admin review.
        </div>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl">Items</h2>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-cream">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <Link href={`/products/${item.product.slug}`} className="font-medium hover:text-sage">
                  {item.product.title}
                </Link>
                <p className="text-xs text-muted">
                  Qty {item.quantity} · {item.product.sku}
                </p>
              </div>
              <p className="shrink-0">{formatINR(item.price * item.quantity)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right font-medium">Total {formatINR(order.totalAmount)}</p>
      </section>

      <section className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-display text-xl">Shipping</h2>
          <div className="mt-3 space-y-1 text-sm text-muted">
            <p className="text-foreground">{address.name}</p>
            <p>{address.address}</p>
            <p>
              {[address.city, address.state, address.pincode].filter(Boolean).join(", ")}
            </p>
            {address.phone && <p>Phone: {address.phone}</p>}
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl">Tracking</h2>
          {order.shipment ? (
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Courier</dt>
                <dd>{order.shipment.courierName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">AWB</dt>
                <dd>{order.shipment.awbCode || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Status</dt>
                <dd>{order.shipment.trackingStatus || "Awaiting sync"}</dd>
              </div>
              {order.shipment.trackingUrl && (
                <div className="pt-2">
                  <a
                    href={order.shipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sage underline"
                  >
                    Open tracking link
                  </a>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">Shipment details will appear after fulfillment.</p>
          )}

          <ol className="mt-4 space-y-2 border-l border-border pl-4 text-sm">
            <li>
              <span className="font-medium">Order placed</span>
              <p className="text-xs text-muted">{order.createdAt.toLocaleString("en-IN")}</p>
            </li>
            {order.paymentStatus === "PAID" && (
              <li>
                <span className="font-medium">Payment confirmed</span>
              </li>
            )}
            {order.shipment?.trackingStatus && (
              <li>
                <span className="font-medium">{order.shipment.trackingStatus}</span>
                <p className="text-xs text-muted">Last synced courier status</p>
              </li>
            )}
            {["SHIPPED", "DELIVERED", "CANCELLED", "CANCEL_REQUESTED", "REFUNDED"].includes(
              order.orderStatus
            ) && (
              <li>
                <span className="font-medium">{order.orderStatus.replaceAll("_", " ")}</span>
              </li>
            )}
          </ol>
        </div>
      </section>

      {canCancel && (
        <section className="mt-10">
          <h2 className="font-display text-xl">Need to cancel?</h2>
          <p className="mt-1 text-sm text-muted">
            Submit a request. An admin will approve or reject it. Refunds for paid orders are handled manually.
          </p>
          <div className="mt-4">
            <CancelOrderForm orderId={order.id} />
          </div>
        </section>
      )}

      {canReturn && (
        <section className="mt-10">
          <h2 className="font-display text-xl">Request a return</h2>
          <p className="mt-1 text-sm text-muted">
            Delivered orders can be returned. Tell us why and we&apos;ll review your request.
          </p>
          <ReturnRequestForm orderId={order.id} />
        </section>
      )}
    </div>
  );
}
