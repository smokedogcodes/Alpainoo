import Razorpay from "razorpay";
import crypto from "crypto";

export function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
}

export function verifyRazorpayWebhookSignature(body: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const payload = `${params.orderId}|${params.paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return expected === params.signature;
}
