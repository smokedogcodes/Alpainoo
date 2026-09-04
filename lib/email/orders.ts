import { sendTransactionalEmail } from "@/lib/email/resend";
import {
  cancelApprovedEmail,
  cancelRejectedEmail,
  cancelRequestedEmail,
  orderPaidEmail,
  orderRefundedEmail,
  orderStatusEmail,
  trackingUpdatedEmail,
  type OrderEmailItem,
  type OrderEmailPayload,
} from "@/lib/email/templates";

type OrderLike = {
  id: string;
  orderNumber: string;
  email: string;
  totalAmount: number;
  orderStatus: string;
  cancelReason?: string | null;
  items?: Array<{
    quantity: number;
    price: number;
    product?: { title?: string | null } | null;
  }>;
  shipment?: {
    courierName?: string | null;
    awbCode?: string | null;
    trackingUrl?: string | null;
    trackingStatus?: string | null;
  } | null;
};

function toPayload(order: OrderLike): OrderEmailPayload {
  const items: OrderEmailItem[] | undefined = order.items?.map((i) => ({
    title: i.product?.title || "Item",
    quantity: i.quantity,
    price: i.price,
  }));

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    email: order.email,
    totalAmount: order.totalAmount,
    orderStatus: order.orderStatus,
    items,
    cancelReason: order.cancelReason,
    courierName: order.shipment?.courierName,
    awbCode: order.shipment?.awbCode,
    trackingUrl: order.shipment?.trackingUrl,
    trackingStatus: order.shipment?.trackingStatus,
  };
}

async function safeSend(
  to: string,
  built: { subject: string; html: string; text: string }
) {
  try {
    await sendTransactionalEmail({ to, ...built });
  } catch (err) {
    console.error("[email] notify failed:", built.subject, err);
  }
}

export async function notifyOrderPaid(order: OrderLike) {
  const payload = toPayload(order);
  await safeSend(payload.email, orderPaidEmail(payload));
}

export async function notifyOrderStatusChanged(order: OrderLike, previousStatus: string) {
  if (previousStatus === order.orderStatus) return;
  const payload = toPayload(order);
  await safeSend(payload.email, orderStatusEmail(payload, previousStatus));
}

export async function notifyCancelRequested(order: OrderLike) {
  const payload = toPayload({ ...order, orderStatus: "CANCEL_REQUESTED" });
  await safeSend(payload.email, cancelRequestedEmail(payload));
}

export async function notifyCancelApproved(order: OrderLike) {
  const payload = toPayload({ ...order, orderStatus: "CANCELLED" });
  await safeSend(payload.email, cancelApprovedEmail(payload));
}

export async function notifyCancelRejected(order: OrderLike) {
  const payload = toPayload(order);
  await safeSend(payload.email, cancelRejectedEmail(payload));
}

export async function notifyTrackingUpdated(order: OrderLike) {
  const payload = toPayload(order);
  await safeSend(payload.email, trackingUpdatedEmail(payload));
}

export async function notifyOrderRefunded(order: OrderLike) {
  const payload = toPayload({ ...order, orderStatus: "REFUNDED" });
  await safeSend(payload.email, orderRefundedEmail(payload));
}
