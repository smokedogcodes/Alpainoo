import { NextResponse } from "next/server";
import { findOrderByRazorpayOrderId } from "@/lib/db/orders";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logError, logSuccess, logWarn } from "@/lib/logging/system-log";

export async function POST(req: Request) {
  const limited = await rateLimit(`webhook:rzp:${clientIp(req)}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    await logError({
      category: "api",
      action: "WEBHOOK_NOT_CONFIGURED",
      message: "RAZORPAY_WEBHOOK_SECRET is not configured",
      path: "/api/webhooks/razorpay",
      method: "POST",
    });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  if (!verifyRazorpayWebhookSignature(body, signature)) {
    await logWarn({
      category: "api",
      action: "WEBHOOK_INVALID_SIGNATURE",
      message: "Invalid Razorpay webhook signature",
      path: "/api/webhooks/razorpay",
      method: "POST",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    event: string;
    payload: {
      payment?: { entity: { order_id: string; id: string } };
      order?: { entity: { id: string } };
    };
  };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const razorpayOrderId =
      event.payload.payment?.entity.order_id || event.payload.order?.entity.id;
    const paymentId = event.payload.payment?.entity.id || `evt_${Date.now()}`;
    if (!razorpayOrderId) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    try {
      const order = await findOrderByRazorpayOrderId(razorpayOrderId);
      if (!order) return NextResponse.json({ ok: true, skipped: true });
      if (order.paymentStatus === "PAID") {
        return NextResponse.json({ ok: true, alreadyPaid: true });
      }
      await fulfillPaidOrder(order.id, paymentId);
      await logSuccess({
        category: "payment",
        action: "WEBHOOK_FULFILLED",
        message: `Webhook fulfilled ${order.orderNumber}`,
        entityType: "Order",
        entityId: order.id,
      });
    } catch (err) {
      await logError({
        category: "payment",
        action: "WEBHOOK_FULFILL_FAILED",
        message: err instanceof Error ? err.message : "Webhook fulfill failed",
        path: "/api/webhooks/razorpay",
        method: "POST",
      });
      return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
