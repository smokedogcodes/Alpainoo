import { createShiprocketOrder } from "@/lib/shiprocket";
import {
  fulfillPaidOrderDb,
  findOrderById,
  upsertShipmentD1,
  type OrderWithItems,
} from "@/lib/db/orders";

/**
 * Idempotent paid-order fulfillment (Prisma local or D1 on Workers).
 */
export async function fulfillPaidOrder(orderId: string, razorpayPaymentId: string) {
  const { order, alreadyPaid } = await fulfillPaidOrderDb(orderId, razorpayPaymentId);

  if (alreadyPaid) return order;

  void import("@/lib/logging/system-log").then(({ logSuccess }) =>
    logSuccess({
      category: "payment",
      action: "ORDER_PAID",
      message: `Order ${order.orderNumber} paid`,
      entityType: "Order",
      entityId: order.id,
      actorEmail: order.email,
      meta: { orderNumber: order.orderNumber, totalAmount: order.totalAmount },
    })
  );

  void import("@/lib/logging/db-audit").then(({ writeDbAudit }) =>
    writeDbAudit({
      tableName: "Order",
      operation: "UPDATE",
      rowId: order.id,
      newData: {
        id: order.id,
        paymentStatus: "PAID",
        orderStatus: order.orderStatus,
        orderNumber: order.orderNumber,
      },
    })
  );

  void import("@/lib/email/orders")
    .then(({ notifyOrderPaid }) => notifyOrderPaid(order))
    .catch((err) => console.error("[email] order paid notify:", err));

  void import("@/lib/whatsapp")
    .then(({ notifyOrderPaidWhatsApp }) => notifyOrderPaidWhatsApp(order))
    .catch(() => undefined);

  for (const item of order.items) {
    void import("@/lib/inventory/alerts")
      .then(({ checkAndNotifyLowStock }) => checkAndNotifyLowStock(item.productId))
      .catch(() => undefined);
  }

  if (order.shipment) return order;

  try {
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
      order_items: order.items.map((i) => ({
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

    await upsertShipmentD1(order.id, {
      orderId: order.id,
      shiprocketOrderId: sr.order_id != null ? String(sr.order_id) : null,
      shipmentId: String(sr.shipment_id ?? ""),
      awbCode: sr.awb_code ? String(sr.awb_code) : null,
      courierName: sr.courier_name ? String(sr.courier_name) : null,
      trackingStatus: "READY_TO_SHIP",
      trackingUrl: sr.tracking_url ? String(sr.tracking_url) : null,
    });
  } catch (err) {
    console.error("Shiprocket fulfillment deferred/failed:", err);
    void import("@/lib/logging/system-log").then(({ logError }) =>
      logError({
        category: "stock",
        action: "SHIPROCKET_FAILED",
        message: err instanceof Error ? err.message : "Shiprocket fulfillment failed",
        entityType: "Order",
        entityId: order.id,
        meta: { orderNumber: order.orderNumber },
      })
    );
  }

  return (await findOrderById(orderId)) as OrderWithItems;
}
