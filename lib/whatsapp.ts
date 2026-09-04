/**
 * WhatsApp Cloud API / provider hooks (fail-soft when not configured).
 * Set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID (Meta Cloud API).
 */
type OrderLike = {
  orderNumber: string;
  email: string;
  totalAmount: number;
  shippingAddress: string;
};

function phoneFromAddress(shippingAddress: string): string | null {
  try {
    const a = JSON.parse(shippingAddress) as { phone?: string };
    const p = (a.phone || "").replace(/\D/g, "");
    if (p.length >= 10) return p.length === 10 ? `91${p}` : p;
  } catch {
    /* ignore */
  }
  return null;
}

export async function sendWhatsAppText(toE164: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) return { skipped: true as const };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toE164,
      type: "text",
      text: { body },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${text.slice(0, 200)}`);
  }
  return { ok: true as const };
}

export async function notifyOrderPaidWhatsApp(order: OrderLike) {
  const phone = phoneFromAddress(order.shippingAddress);
  if (!phone) return;
  await sendWhatsAppText(
    phone,
    `Alpainoo: Order ${order.orderNumber} paid (₹${order.totalAmount}). We'll update you when it ships.`
  );
}

export async function notifyOrderShippedWhatsApp(
  order: OrderLike,
  trackingUrl?: string | null
) {
  const phone = phoneFromAddress(order.shippingAddress);
  if (!phone) return;
  await sendWhatsAppText(
    phone,
    `Alpainoo: Order ${order.orderNumber} shipped.${trackingUrl ? ` Track: ${trackingUrl}` : ""}`
  );
}
