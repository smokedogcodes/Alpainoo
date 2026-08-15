import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limited = await rateLimit(`webhook:rzp:${clientIp(req)}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  const valid = verifyRazorpayWebhookSignature(body, signature);
  if (!valid) {
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

    const order = await prisma.order.findFirst({ where: { razorpayOrderId } });
    if (!order) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    // Idempotent: already PAID → 200 without side effects
    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ ok: true, alreadyPaid: true });
    }
    await fulfillPaidOrder(order.id, paymentId);
  }

  return NextResponse.json({ ok: true });
}
