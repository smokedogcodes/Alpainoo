import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { fulfillPaidOrder } from "@/lib/fulfillment";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  if (process.env.RAZORPAY_WEBHOOK_SECRET) {
    const valid = verifyRazorpayWebhookSignature(body, signature);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  const event = JSON.parse(body) as {
    event: string;
    payload: {
      payment?: { entity: { order_id: string; id: string } };
      order?: { entity: { id: string } };
    };
  };

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const razorpayOrderId =
      event.payload.payment?.entity.order_id || event.payload.order?.entity.id;
    const paymentId = event.payload.payment?.entity.id || `evt_${Date.now()}`;
    if (!razorpayOrderId) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const order = await prisma.order.findFirst({ where: { razorpayOrderId } });
    if (order && order.paymentStatus !== "PAID") {
      await fulfillPaidOrder(order.id, paymentId);
    }
  }

  return NextResponse.json({ ok: true });
}
