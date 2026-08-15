import { prisma } from "@/lib/prisma";
import { createShiprocketOrder } from "@/lib/shiprocket";

export async function fulfillPaidOrder(orderId: string, razorpayPaymentId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, shipment: true },
    });
    if (!order) throw new Error("Order not found");
    if (order.paymentStatus === "PAID") return order;

    for (const item of order.items) {
      if (item.product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.product.title}`);
      }
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
      await tx.stockLog.create({
        data: {
          productId: item.productId,
          change: -item.quantity,
          note: `Order ${order.orderNumber}`,
        },
      });
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "PAID",
        orderStatus: "PAID",
        razorpayPaymentId,
      },
      include: { items: { include: { product: true } } },
    });

    const address = JSON.parse(order.shippingAddress) as {
      name: string;
      phone: string;
      address: string;
      city: string;
      state: string;
      pincode: string;
    };

    const sr = await createShiprocketOrder({
      order_id: order.orderNumber,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_location: "Primary",
      billing_customer_name: address.name.split(" ")[0] || address.name,
      billing_last_name: address.name.split(" ").slice(1).join(" ") || undefined,
      billing_address: address.address,
      billing_city: address.city,
      billing_pincode: address.pincode,
      billing_state: address.state,
      billing_country: "India",
      billing_email: order.email,
      billing_phone: address.phone,
      shipping_is_billing: true,
      order_items: updated.items.map((i) => ({
        name: i.product.title,
        sku: i.product.sku,
        units: i.quantity,
        selling_price: i.price,
      })),
      payment_method: "Prepaid",
      sub_total: order.totalAmount,
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    });

    await tx.shipment.create({
      data: {
        orderId: order.id,
        shiprocketOrderId: sr.order_id != null ? String(sr.order_id) : null,
        shipmentId: String(sr.shipment_id ?? ""),
        awbCode: sr.awb_code ? String(sr.awb_code) : null,
        courierName: sr.courier_name ? String(sr.courier_name) : null,
        trackingStatus: "READY_TO_SHIP",
        trackingUrl: sr.tracking_url ? String(sr.tracking_url) : null,
      },
    });

    return updated;
  });
}
