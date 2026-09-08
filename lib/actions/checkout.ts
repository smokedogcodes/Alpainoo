"use server";

import { getRazorpay, verifyPaymentSignature } from "@/lib/razorpay";
import { auth } from "@/auth";
import { CheckoutSchema, VerifyPaymentSchema } from "@/lib/validation";
import { signOrderAccess, verifyOrderAccess } from "@/lib/security/order-access";
import { opaqueHref } from "@/lib/security/opaque-routes";
import { getProductById } from "@/lib/db/products";
import { upsertUserByEmail } from "@/lib/db/users";
import {
  createOrderBundle,
  findOrderById,
} from "@/lib/db/orders";

export type CheckoutInput = {
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  items: Array<{ productId: string; quantity: number; variantId?: string }>;
  couponCode?: string;
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
      successUrl: string;
      paymentToken: string;
    }
  | { ok: false; error: string };

function successUrlFor(
  order: { id: string; orderNumber: string },
  userId: string,
  celebrate: boolean
) {
  const t = signOrderAccess({
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId,
    celebrate,
  });
  return opaqueHref(`/checkout/success?t=${encodeURIComponent(t)}`);
}

function paymentTokenFor(order: { id: string; orderNumber: string }, userId: string) {
  return signOrderAccess({
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId,
    celebrate: false,
  });
}

function ownsOrder(
  order: { id: string; userId: string | null; email: string },
  session: { user?: { id?: string | null; email?: string | null } | null } | null,
  paymentToken?: string
) {
  if (session?.user?.id && order.userId === session.user.id) return true;
  if (
    session?.user?.email &&
    order.email.toLowerCase() === session.user.email.toLowerCase()
  ) {
    return true;
  }
  if (paymentToken) {
    const access = verifyOrderAccess(paymentToken);
    if (
      access &&
      access.orderId === order.id &&
      order.userId &&
      access.userId === order.userId
    ) {
      return true;
    }
  }
  return false;
}

export async function createCheckoutOrder(input: CheckoutInput): Promise<CheckoutOrderResult> {
  const session = await auth();

  const parsed = CheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid checkout data" };
  }
  const data = parsed.data;

  try {
    const { checkPincodeServiceability } = await import("@/lib/shiprocket");
    const serviceability = await checkPincodeServiceability(data.pincode);
    if (!serviceability.available) {
      return {
        ok: false,
        error: "We cannot deliver to this pin code yet. Please try a different address.",
      };
    }

    const qtyByLine = new Map<string, { productId: string; variantId?: string; quantity: number }>();
    for (const item of data.items) {
      const key = item.variantId ? `${item.productId}:${item.variantId}` : item.productId;
      const prev = qtyByLine.get(key);
      qtyByLine.set(key, {
        productId: item.productId,
        variantId: item.variantId,
        quantity: (prev?.quantity ?? 0) + item.quantity,
      });
    }

    const { listPublicVariants } = await import("@/lib/actions/variants");
    const lineItems: Array<{
      product: NonNullable<Awaited<ReturnType<typeof getProductById>>>;
      quantity: number;
      price: number;
      variantId?: string;
    }> = [];

    for (const line of Array.from(qtyByLine.values())) {
      const product = await getProductById(line.productId);
      if (!product || product.isHidden) throw new Error("Product not found");

      if (line.variantId) {
        const variants = await listPublicVariants(product.id);
        const variant = variants.find((v) => v.id === line.variantId);
        if (!variant) throw new Error(`Variant unavailable for ${product.title}`);
        if (variant.stock < line.quantity) {
          throw new Error(`${product.title} (${variant.name}) is out of stock`);
        }
        lineItems.push({
          product,
          quantity: line.quantity,
          price: variant.sellingPrice ?? product.sellingPrice,
          variantId: variant.id,
        });
      } else {
        if (product.stock < line.quantity) throw new Error(`${product.title} is out of stock`);
        lineItems.push({
          product,
          quantity: line.quantity,
          price: product.sellingPrice,
        });
      }
    }

    const subtotalAmount = lineItems.reduce((s, l) => s + l.price * l.quantity, 0);
    let discountAmount = 0;
    let couponCode: string | null = null;
    let merchandiseTotal = subtotalAmount;

    if (input.couponCode?.trim()) {
      try {
        const { applyCouponToTotal } = await import("@/lib/coupons");
        const discounted = await applyCouponToTotal(input.couponCode.trim(), subtotalAmount);
        merchandiseTotal = discounted.total;
        discountAmount = discounted.discount;
        couponCode = discounted.coupon.code.toUpperCase();
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Invalid coupon",
        };
      }
    }

    const { calcShippingFee } = await import("@/lib/shipping");
    const shippingAmount = calcShippingFee(merchandiseTotal);
    const totalAmount = Math.round((merchandiseTotal + shippingAmount) * 100) / 100;

    if (totalAmount <= 0) throw new Error("Invalid order total");

    const orderNumber = `EK${Date.now().toString().slice(-10)}`;

    const user = await upsertUserByEmail({
      email: session?.user?.email || data.email,
      name: session?.user?.name || data.name,
      image: session?.user?.image || null,
    });
    const userId = user.id;

    const shippingAddress = JSON.stringify({
      name: data.name,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      deliveryEstimate: serviceability.estimate || null,
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

    const order = await createOrderBundle({
      orderNumber,
      userId,
      email: data.email,
      totalAmount,
      subtotalAmount,
      discountAmount,
      shippingAmount,
      couponCode,
      razorpayOrderId,
      shippingAddress,
      lines: lineItems.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
        price: l.price,
        variantId: l.variantId || null,
      })),
    });

    void import("@/lib/logging/db-audit").then(({ writeDbAudit }) =>
      writeDbAudit({
        tableName: "Order",
        operation: "INSERT",
        rowId: order.id,
        newData: {
          id: order.id,
          orderNumber: order.orderNumber,
          email: order.email,
          totalAmount: order.totalAmount,
          orderStatus: order.orderStatus,
          couponCode,
          discountAmount,
          shippingAmount,
        },
      })
    );

    void import("@/lib/logging/system-log").then(({ logSuccess }) =>
      logSuccess({
        category: "checkout",
        action: "ORDER_CREATED",
        message: `Order ${order.orderNumber} created`,
        entityType: "Order",
        entityId: order.id,
        actorUserId: userId,
        actorEmail: data.email,
        meta: {
          totalAmount,
          subtotalAmount,
          discountAmount,
          shippingAmount,
          couponCode,
          itemCount: lineItems.length,
          guest: !session?.user?.id,
          mock: !razorpay,
        },
      })
    );

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      razorpayOrderId,
      amount: totalAmount,
      currency: "INR",
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "",
      mock: !razorpay,
      successUrl: successUrlFor(order, userId, true),
      paymentToken: paymentTokenFor(order, userId),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    void import("@/lib/logging/system-log").then(({ logError }) =>
      logError({
        category: "checkout",
        action: "ORDER_CREATE_FAILED",
        message,
        actorEmail: input.email,
        meta: { email: input.email },
      })
    );
    return {
      ok: false,
      error:
        message.includes("stock") || message.includes("Product") || message.includes("pin")
          ? message
          : "Checkout failed. Please try again.",
    };
  }
}

export async function confirmMockPayment(
  orderId: string,
  paymentToken?: string
): Promise<{ ok: true; successUrl: string } | { ok: false; error: string }> {
  if (getRazorpay()) {
    return { ok: false, error: "Use Razorpay checkout" };
  }
  if (!orderId || typeof orderId !== "string" || orderId.length > 64) {
    return { ok: false, error: "Invalid order" };
  }

  const session = await auth();

  try {
    const order = await findOrderById(orderId);
    if (!order || order.paymentStatus !== "PENDING") {
      return { ok: false, error: "Order not found" };
    }
    if (!ownsOrder(order, session, paymentToken)) {
      return { ok: false, error: "Please sign in" };
    }

    const { fulfillPaidOrder } = await import("@/lib/fulfillment");
    await fulfillPaidOrder(order.id, `pay_mock_${Date.now()}`);
    const userId = order.userId || session?.user?.id || "";
    return { ok: true, successUrl: successUrlFor(order, userId, true) };
  } catch {
    return { ok: false, error: "Payment failed" };
  }
}

export async function verifyAndFulfillPayment(input: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  paymentToken?: string;
}): Promise<
  { ok: true; alreadyPaid?: boolean; successUrl: string } | { ok: false; error: string }
> {
  const parsed = VerifyPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid payment payload" };

  const session = await auth();

  try {
    const order = await findOrderById(parsed.data.orderId);
    if (!order) return { ok: false, error: "Order not found" };
    if (!ownsOrder(order, session, input.paymentToken)) {
      return { ok: false, error: "Please sign in" };
    }
    if (order.razorpayOrderId !== parsed.data.razorpayOrderId) {
      return { ok: false, error: "Order mismatch" };
    }

    const userId = order.userId || session?.user?.id || "";
    if (order.paymentStatus === "PAID") {
      return {
        ok: true,
        alreadyPaid: true,
        successUrl: successUrlFor(order, userId, false),
      };
    }

    const valid = verifyPaymentSignature({
      orderId: parsed.data.razorpayOrderId,
      paymentId: parsed.data.razorpayPaymentId,
      signature: parsed.data.razorpaySignature,
    });
    if (!valid) return { ok: false, error: "Invalid payment signature" };

    const { fulfillPaidOrder } = await import("@/lib/fulfillment");
    await fulfillPaidOrder(order.id, parsed.data.razorpayPaymentId);
    return {
      ok: true,
      alreadyPaid: false,
      successUrl: successUrlFor(order, userId, true),
    };
  } catch {
    return { ok: false, error: "Payment verification failed" };
  }
}
