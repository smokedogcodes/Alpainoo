import { formatINR } from "@/lib/utils";

export type OrderEmailItem = {
  title: string;
  quantity: number;
  price: number;
};

export type OrderEmailPayload = {
  orderId: string;
  orderNumber: string;
  email: string;
  totalAmount: number;
  orderStatus: string;
  items?: OrderEmailItem[];
  cancelReason?: string | null;
  courierName?: string | null;
  awbCode?: string | null;
  trackingUrl?: string | null;
  trackingStatus?: string | null;
};

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://alpainoo-gamma.vercel.app").replace(/\/$/, "");
}

export function orderUrl(orderId: string) {
  return `${appBaseUrl()}/orders/${orderId}`;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function itemsHtml(items?: OrderEmailItem[]) {
  if (!items?.length) return "";
  const rows = items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #e8e4dc;">${escapeHtml(i.title)} × ${i.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e8e4dc;text-align:right;">${formatINR(i.price * i.quantity)}</td>
        </tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>`;
}

function itemsText(items?: OrderEmailItem[]) {
  if (!items?.length) return "";
  return items.map((i) => `- ${i.title} × ${i.quantity}: ${formatINR(i.price * i.quantity)}`).join("\n");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, bodyHtml: string, order: OrderEmailPayload) {
  const link = orderUrl(order.orderId);
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:24px auto;background:#fffaf3;border:1px solid #e8e4dc;padding:28px;">
    <p style="margin:0 0 4px;font-size:22px;color:#5a6b4f;letter-spacing:0.02em;">Alpainoo</p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:normal;color:#2c2a26;">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="margin:20px 0 0;">
      <a href="${link}" style="display:inline-block;background:#5a6b4f;color:#fff;text-decoration:none;padding:12px 18px;font-size:14px;">View order</a>
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:#8a857c;">Order ${escapeHtml(order.orderNumber)} · ${formatINR(order.totalAmount)}</p>
  </div>
</body>
</html>`;
}

function textFooter(order: OrderEmailPayload) {
  return `\n\nView order: ${orderUrl(order.orderId)}\nOrder ${order.orderNumber} · ${formatINR(order.totalAmount)}\n— Alpainoo`;
}

export function orderPaidEmail(order: OrderEmailPayload) {
  const subject = `Order confirmed — ${order.orderNumber}`;
  const html = layout(
    "Thank you for your order",
    `<p style="color:#4a463f;line-height:1.5;">We've received payment for <strong>${escapeHtml(order.orderNumber)}</strong>. We'll notify you when it ships.</p>
     ${itemsHtml(order.items)}
     <p style="color:#4a463f;"><strong>Total:</strong> ${formatINR(order.totalAmount)}</p>`,
    order
  );
  const text = `Thank you for your order ${order.orderNumber}.\n\n${itemsText(order.items)}\nTotal: ${formatINR(order.totalAmount)}${textFooter(order)}`;
  return { subject, html, text };
}

export function orderStatusEmail(order: OrderEmailPayload, previousStatus?: string) {
  const label = statusLabel(order.orderStatus);
  const subject = `Order ${order.orderNumber} is now ${label}`;
  const prev = previousStatus ? ` (was ${statusLabel(previousStatus)})` : "";
  const html = layout(
    `Status update: ${label}`,
    `<p style="color:#4a463f;line-height:1.5;">Your order <strong>${escapeHtml(order.orderNumber)}</strong> is now <strong>${escapeHtml(label)}</strong>${escapeHtml(prev)}.</p>
     ${itemsHtml(order.items)}`,
    order
  );
  const text = `Your order ${order.orderNumber} is now ${label}${prev}.${textFooter(order)}`;
  return { subject, html, text };
}

export function cancelRequestedEmail(order: OrderEmailPayload) {
  const subject = `Cancel request received — ${order.orderNumber}`;
  const reason = order.cancelReason ? `<p style="color:#4a463f;"><strong>Reason:</strong> ${escapeHtml(order.cancelReason)}</p>` : "";
  const html = layout(
    "Cancellation request received",
    `<p style="color:#4a463f;line-height:1.5;">We've received your request to cancel <strong>${escapeHtml(order.orderNumber)}</strong>. An admin will review it shortly.</p>${reason}`,
    order
  );
  const text = `Cancel request received for ${order.orderNumber}.${order.cancelReason ? `\nReason: ${order.cancelReason}` : ""}${textFooter(order)}`;
  return { subject, html, text };
}

export function cancelApprovedEmail(order: OrderEmailPayload) {
  const subject = `Order cancelled — ${order.orderNumber}`;
  const html = layout(
    "Your order has been cancelled",
    `<p style="color:#4a463f;line-height:1.5;">Order <strong>${escapeHtml(order.orderNumber)}</strong> has been cancelled. If you paid online, refunds are handled manually — contact us if you need help.</p>`,
    order
  );
  const text = `Order ${order.orderNumber} has been cancelled.${textFooter(order)}`;
  return { subject, html, text };
}

export function cancelRejectedEmail(order: OrderEmailPayload) {
  const subject = `Cancel request declined — ${order.orderNumber}`;
  const html = layout(
    "Cancellation request declined",
    `<p style="color:#4a463f;line-height:1.5;">Your cancel request for <strong>${escapeHtml(order.orderNumber)}</strong> was not approved. The order continues as <strong>${escapeHtml(statusLabel(order.orderStatus))}</strong>.</p>`,
    order
  );
  const text = `Cancel request for ${order.orderNumber} was declined. Status: ${statusLabel(order.orderStatus)}.${textFooter(order)}`;
  return { subject, html, text };
}

export function orderRefundedEmail(order: OrderEmailPayload) {
  const subject = `Refund processed — ${order.orderNumber}`;
  const html = layout(
    "Your refund has been processed",
    `<p style="color:#4a463f;line-height:1.5;">We've refunded order <strong>${escapeHtml(order.orderNumber)}</strong> for <strong>${formatINR(order.totalAmount)}</strong>. Funds usually appear in 5–7 business days depending on your bank.</p>`,
    order
  );
  const text = `Refund processed for ${order.orderNumber} (${formatINR(order.totalAmount)}).${textFooter(order)}`;
  return { subject, html, text };
}

export function trackingUpdatedEmail(order: OrderEmailPayload) {
  const subject = `Tracking update — ${order.orderNumber}`;
  const bits = [
    order.trackingStatus ? `<li>Status: ${escapeHtml(order.trackingStatus)}</li>` : "",
    order.courierName ? `<li>Courier: ${escapeHtml(order.courierName)}</li>` : "",
    order.awbCode ? `<li>AWB: ${escapeHtml(order.awbCode)}</li>` : "",
    order.trackingUrl
      ? `<li><a href="${escapeHtml(order.trackingUrl)}">Open tracking link</a></li>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const html = layout(
    "Shipment tracking update",
    `<p style="color:#4a463f;line-height:1.5;">There's a tracking update for <strong>${escapeHtml(order.orderNumber)}</strong>.</p>
     <ul style="color:#4a463f;line-height:1.6;">${bits}</ul>
     <p style="color:#4a463f;">Order status: <strong>${escapeHtml(statusLabel(order.orderStatus))}</strong></p>`,
    order
  );
  const text = [
    `Tracking update for ${order.orderNumber}.`,
    order.trackingStatus ? `Status: ${order.trackingStatus}` : "",
    order.courierName ? `Courier: ${order.courierName}` : "",
    order.awbCode ? `AWB: ${order.awbCode}` : "",
    order.trackingUrl ? `Track: ${order.trackingUrl}` : "",
    `Order status: ${statusLabel(order.orderStatus)}`,
    textFooter(order),
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}
