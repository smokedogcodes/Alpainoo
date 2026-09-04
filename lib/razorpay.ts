import crypto from "crypto";
import Razorpay from "razorpay";

function timingSafeEqualHex(a: string, b: string) {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function getRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
}

export function verifyRazorpayWebhookSignature(body: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqualHex(expected, signature);
}

export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !params.signature) return false;
  const payload = `${params.orderId}|${params.paymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return timingSafeEqualHex(expected, params.signature);
}

/**
 * Refund a Razorpay payment. When keys are missing, returns a mock skip result.
 */
export async function createRefund(
  paymentId: string,
  opts?: { amountPaise?: number; notes?: Record<string, string> }
) {
  const rzp = getRazorpay();
  if (!rzp) {
    return { skipped: true as const, mock: true as const, id: `mock_rfnd_${paymentId.slice(0, 12)}` };
  }
  if (!paymentId) throw new Error("Missing payment id");

  const refund = await rzp.payments.refund(paymentId, {
    ...(opts?.amountPaise != null ? { amount: opts.amountPaise } : {}),
    ...(opts?.notes ? { notes: opts.notes } : {}),
  });
  return {
    skipped: false as const,
    mock: false as const,
    id: String((refund as { id?: string }).id || ""),
    raw: refund,
  };
}
