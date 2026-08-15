"use server";

import { prisma } from "@/lib/prisma";
import { getRazorpay } from "@/lib/razorpay";
import { auth } from "@/auth";

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

export async function createCheckoutOrder(input: CheckoutInput) {
  if (!input.items.length) throw new Error("Cart is empty");

  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) }, isHidden: false },
  });

  const lineItems = input.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new Error("Product not found");
    if (product.stock < item.quantity) throw new Error(`${product.title} is out of stock`);
    return { product, quantity: item.quantity, price: product.sellingPrice };
  });

  const totalAmount = lineItems.reduce((s, l) => s + l.price * l.quantity, 0);
  const orderNumber = `EK${Date.now().toString().slice(-10)}`;

  let userId: string | undefined;
  const session = await auth();
  if (session?.user?.email) {
    const user = await prisma.user.upsert({
      where: { email: session.user.email },
      create: {
        email: session.user.email,
        name: session.user.name || input.name,
        image: session.user.image || null,
        avatarUrl: session.user.image || null,
      },
      update: {},
    });
    userId = user.id;
  }

  const shippingAddress = JSON.stringify({
    name: input.name,
    phone: input.phone,
    address: input.address,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
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
      email: input.email,
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
    orderId: order.id,
    orderNumber: order.orderNumber,
    razorpayOrderId,
    amount: totalAmount,
    currency: "INR",
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "",
    mock: !razorpay,
  };
}

export async function confirmMockPayment(orderId: string) {
  // Dev-only path when Razorpay keys are absent
  if (process.env.RAZORPAY_KEY_ID) {
    throw new Error("Use Razorpay checkout in production mode");
  }
  const { fulfillPaidOrder } = await import("@/lib/fulfillment");
  await fulfillPaidOrder(orderId, `pay_mock_${Date.now()}`);
  return { ok: true };
}
