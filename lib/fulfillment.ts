import { prisma } from "@/lib/prisma";
import { createShiprocketOrder } from "@/lib/shiprocket";

/**
 * Idempotent paid-order fulfillment:
 * - If already PAID → return immediately (no double stock / Shiprocket)
 * - Stock decremented atomically with stock >= quantity guard
 * - External Shiprocket call runs after DB commit
 */
export async function fulfillPaidOrder(orderId: string, razorpayPaymentId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, shipment: true },
    });
    if (!order) throw new Error("Order not found");
    if (order.paymentStatus === "PAID") return { order, alreadyPaid: true as const };

    for (const item of order.items) {
      const result = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (result.count !== 1) {
        throw new Error(`Insufficient stock for ${item.product.title}`);
      }
      await tx.stockLog.create({
        data: {
          productId: item.productId,
          change: -item.quantity,
          note: `Order ${order.orderNumber}`,
        },
      });
    }

    const paid = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        orderStatus: "PAID",
        razorpayPaymentId,
      },
      include: { items: { include: { product: true } }, shipment: true },
    });

    return { order: paid, alreadyPaid: false as const };
  });

  if (updated.alreadyPaid) return updated.order;
  if (updated.order.shipment) return updated.order;

  try {
    const address = JSON.parse(updated.order.shippingAddress) as {
      name: string;
      phone: string;
      address: string;
      city: string;
      state: string;
      pincode: string;
    };

    const sr = await createShiprocketOrder({
      order_id: updated.order.orderNumber,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_location: "Primary",
      billing_customer_name: address.name.split(" ")[0] || address.name,
      billing_last_name: address.name.split(" ").slice(1).join(" ") || undefined,
      billing_address: address.address,
      billing_city: address.city,
      billing_pincode: address.pincode,
      billing_state: address.state,
      billing_country: "India",
      billing_email: updated.order.email,
      billing_phone: address.phone,
      shipping_is_billing: true,
      order_items: updated.order.items.map((i) => ({
        name: i.product.title,
        sku: i.product.sku,
        units: i.quantity,
        selling_price: i.price,
      })),
      payment_method: "Prepaid",
      sub_total: updated.order.totalAmount,
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    });

    await prisma.shipment.create({
      data: {
        orderId: updated.order.id,
        shiprocketOrderId: sr.order_id != null ? String(sr.order_id) : null,
        shipmentId: String(sr.shipment_id ?? ""),
        awbCode: sr.awb_code ? String(sr.awb_code) : null,
        courierName: sr.courier_name ? String(sr.courier_name) : null,
        trackingStatus: "READY_TO_SHIP",
        trackingUrl: sr.tracking_url ? String(sr.tracking_url) : null,
      },
    });
  } catch (err) {
    console.error("Shiprocket fulfillment deferred/failed:", err);
  }

  return updated.order;
}
