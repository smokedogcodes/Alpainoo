import { fulfillPaidOrderDb, findOrderById, type OrderWithItems } from "@/lib/db/orders";
import { shipOrderWithShiprocket } from "@/lib/fulfillment-shiprocket";

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

  if (order.shipment?.awbCode) return order;

  try {
    await shipOrderWithShiprocket(orderId, { requireCredentials: false });
  } catch (err) {
    console.error("Shiprocket fulfillment deferred/failed:", err);
  }

  return (await findOrderById(orderId)) as OrderWithItems;
}
