"use server";

import { prisma } from "@/lib/prisma";
import { getRazorpay, verifyPaymentSignature } from "@/lib/razorpay";
import { auth } from "@/auth";
import { CheckoutSchema, VerifyPaymentSchema } from "@/lib/validation";

export type CheckoutInput = {
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  items: Array<{ productId: string; quantity: number }>;
};

export type CheckoutOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      razorpayOrderId: string | null;
      amount: number;
      currency: string;
      key: string;
      mock: boolean;
    }
  | { ok: false; error: string };

export async function createCheckoutOrder(input: CheckoutInput): Promise<CheckoutOrderResult> {
  const parsed = CheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid checkout data" };
  }
  const data = parsed.data;

  try {
    const qtyByProduct = new Map<string, number>();
    for (const item of data.items) {
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
    }
    const productIds = Array.from(qtyByProduct.keys());

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isHidden: false },
    });

    const lineItems = productIds.map((productId) => {
      const product = products.find((p) => p.id === productId);
      const quantity = qtyByProduct.get(productId)!;
      if (!product) throw new Error("Product not found");
      if (product.stock < quantity) throw new Error(`${product.title} is out of stock`);
      return { product, quantity, price: product.sellingPrice };
    });

    const totalAmount = lineItems.reduce((s, l) => s + l.price * l.quantity, 0);
    if (totalAmount <= 0) throw new Error("Invalid order total");

    const orderNumber = `EK${Date.now().toString().slice(-10)}`;

    let userId: string | undefined;
    const session = await auth();
    if (session?.user?.email) {
      const user = await prisma.user.upsert({
        where: { email: session.user.email },
        create: {
          email: session.user.email,
          name: session.user.name || data.name,
          image: session.user.image || null,
          avatarUrl: session.user.image || null,
        },
        update: {},
      });
      userId = user.id;
    }

    const shippingAddress = JSON.stringify({
      name: data.name,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
    });

    const razorpay = getRazorpay();
    let razorpayOrderId: string | null = null;

    if (razorpay) {
      const rzOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        receipt: orderNumber,
      });
      razorpayOrderId = rzOrder.id;
    } else {
      razorpayOrderId = `order_mock_${orderNumber}`;
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        email: data.email,
        totalAmount,
        paymentStatus: "PENDING",
        orderStatus: "PENDING",
        razorpayOrderId,
        shippingAddress,
        items: {
          create: lineItems.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
            price: l.price,
          })),
        },
      },
    });

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      razorpayOrderId,
      amount: totalAmount,
      currency: "INR",
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "",
      mock: !razorpay,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Checkout failed",
    };
  }
}

/**
 * Demo payment when Razorpay keys are not configured.
 * Blocked whenever live Razorpay credentials exist.
 */
export async function confirmMockPayment(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (getRazorpay()) {
    return { ok: false, error: "Use Razorpay checkout" };
  }
  if (!orderId || typeof orderId !== "string") {
    return { ok: false, error: "Invalid order" };
  }

  try {
    const { fulfillPaidOrder } = await import("@/lib/fulfillment");
    await fulfillPaidOrder(orderId, `pay_mock_${Date.now()}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Payment failed" };
  }
}

/** Verify Razorpay checkout signature server-side, then fulfill */
export async function verifyAndFulfillPayment(input: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<{ ok: true; alreadyPaid?: boolean } | { ok: false; error: string }> {
  const parsed = VerifyPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid payment payload" };

  try {
    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order) return { ok: false, error: "Order not found" };
    if (order.razorpayOrderId !== parsed.data.razorpayOrderId) {
      return { ok: false, error: "Order mismatch" };
    }
    if (order.paymentStatus === "PAID") return { ok: true, alreadyPaid: true };

    const valid = verifyPaymentSignature({
      orderId: parsed.data.razorpayOrderId,
      paymentId: parsed.data.razorpayPaymentId,
      signature: parsed.data.razorpaySignature,
    });
    if (!valid) return { ok: false, error: "Invalid payment signature" };

    const { fulfillPaidOrder } = await import("@/lib/fulfillment");
    await fulfillPaidOrder(order.id, parsed.data.razorpayPaymentId);
    return { ok: true, alreadyPaid: false };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Payment verification failed" };
  }
}
