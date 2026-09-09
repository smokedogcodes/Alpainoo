import {
  assignAwb,
  createShiprocketOrder,
  generateTrackingUrl,
  getPickupLocation,
  getShiprocketCredentials,
  validateShiprocketPhone,
  validateShiprocketPincode,
  validateShiprocketWeight,
} from "@/lib/shiprocket";
import {
  findOrderById,
  updateOrderStatusDb,
  upsertShipmentD1,
  type OrderWithItems,
} from "@/lib/db/orders";

export type ShipOrderResult = {
  order: OrderWithItems;
  shipmentId: string | null;
  awbCode: string | null;
  trackingUrl: string | null;
  orderStatus: string;
  mock: boolean;
  /** Soft warning (e.g. KYC blocked AWB) — shipment may still be created */
  warning?: string | null;
};

type AddressJson = {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

function isKycBlockMessage(message: string) {
  return /kyc/i.test(message);
}

/**
 * Create Shiprocket adhoc order, assign AWB if needed, persist Shipment, update order status.
 * @param opts.requireCredentials — when true (admin), never mock; throw if creds missing
 */
export async function shipOrderWithShiprocket(
  orderId: string,
  opts?: { requireCredentials?: boolean; weightKg?: number }
): Promise<ShipOrderResult> {
  const order = await findOrderById(orderId);
  if (!order) throw new Error("Order not found");

  if (order.shipment?.awbCode) {
    return {
      order,
      shipmentId: order.shipment.shipmentId,
      awbCode: order.shipment.awbCode,
      trackingUrl: order.shipment.trackingUrl,
      orderStatus: order.orderStatus,
      mock: false,
    };
  }

  if (
    order.orderStatus === "CANCELLED" ||
    order.orderStatus === "REFUNDED" ||
    order.orderStatus === "CANCEL_REQUESTED"
  ) {
    throw new Error(`Cannot ship order in status ${order.orderStatus}`);
  }

  const requireCreds = opts?.requireCredentials === true;
  if (requireCreds && !getShiprocketCredentials().configured) {
    throw new Error("Shiprocket credentials are not configured");
  }

  let address: AddressJson;
  try {
    address = JSON.parse(order.shippingAddress) as AddressJson;
  } catch {
    throw new Error("Invalid shipping address on order");
  }

  const pincode = String(address.pincode || "").trim();
  const phoneRaw = String(address.phone || "").trim();
  const name = String(address.name || "").trim() || "Customer";
  validateShiprocketPincode(pincode);
  const phone = validateShiprocketPhone(phoneRaw);

  const weight = opts?.weightKg ?? 0.5;
  validateShiprocketWeight(weight);

  if (!order.items.length) throw new Error("Order has no line items");

  try {
    let shipmentId = order.shipment?.shipmentId || null;
    let shiprocketOrderId = order.shipment?.shiprocketOrderId || null;
    let awbCode = order.shipment?.awbCode || null;
    let courierName = order.shipment?.courierName || null;
    let mock = false;
    let warning: string | null = null;

    // Create Shiprocket order only if we don't already have a shipment id
    if (!shipmentId) {
      const sr = await createShiprocketOrder(
        {
          order_id: order.orderNumber,
          order_date: new Date().toISOString().slice(0, 10),
          pickup_location: getPickupLocation(),
          billing_customer_name: name.split(" ")[0] || name,
          billing_last_name: name.split(" ").slice(1).join(" ") || undefined,
          billing_address: String(address.address || "").trim() || "Address",
          billing_city: String(address.city || "").trim() || "City",
          billing_pincode: pincode,
          billing_state: String(address.state || "").trim() || "State",
          billing_country: "India",
          billing_email: order.email,
          billing_phone: phone,
          shipping_is_billing: true,
          order_items: order.items.map((i) => ({
            name: i.product.title,
            sku: i.product.sku || i.productId,
            units: i.quantity,
            selling_price: i.price,
          })),
          payment_method: "Prepaid",
          sub_total: order.totalAmount,
          length: 10,
          breadth: 10,
          height: 10,
          weight,
        },
        { allowMock: !requireCreds }
      );

      mock = Boolean(sr.mock);
      shipmentId =
        sr.shipment_id != null && String(sr.shipment_id) !== ""
          ? String(sr.shipment_id)
          : null;
      shiprocketOrderId =
        sr.order_id != null ? String(sr.order_id) : shiprocketOrderId;
      if (sr.awb_code) awbCode = String(sr.awb_code);
      if (sr.courier_name) courierName = String(sr.courier_name);

      // Persist immediately so retries don't create duplicate Shiprocket orders
      await upsertShipmentD1(order.id, {
        orderId: order.id,
        shippingPartner: "SHIPROCKET",
        shiprocketOrderId,
        shipmentId: shipmentId || "",
        awbCode,
        courierName,
        trackingStatus: awbCode ? "READY_TO_SHIP" : "CREATED",
        trackingUrl: awbCode ? generateTrackingUrl(awbCode) : null,
      });
    }

    if (!mock && shipmentId && !awbCode) {
      try {
        const assigned = await assignAwb(shipmentId);
        if (assigned.awb_code) awbCode = String(assigned.awb_code);
        if (assigned.courier_name) courierName = String(assigned.courier_name);
      } catch (assignErr) {
        const msg =
          assignErr instanceof Error ? assignErr.message : "AWB assign failed";
        void import("@/lib/logging/system-log").then(({ logError }) =>
          logError({
            category: "stock",
            action: "SHIPROCKET_FAILED",
            message: msg,
            entityType: "Order",
            entityId: order.id,
            meta: { orderNumber: order.orderNumber, stage: "assign_awb" },
          })
        );

        if (isKycBlockMessage(msg)) {
          warning =
            "Shiprocket order created, but AWB could not be assigned: complete KYC verification in your Shiprocket dashboard, then click Ship with Shiprocket again (or Refresh tracking).";
        } else {
          // Non-KYC assign failures still surface as hard errors after persisting create
          throw new Error(msg);
        }
      }
    }

    const trackingUrl = awbCode
      ? generateTrackingUrl(awbCode)
      : order.shipment?.trackingUrl || null;

    await upsertShipmentD1(order.id, {
      orderId: order.id,
      shippingPartner: "SHIPROCKET",
      shiprocketOrderId,
      shipmentId: shipmentId || "",
      awbCode,
      courierName,
      trackingStatus: awbCode ? "READY_TO_SHIP" : "AWAITING_AWB",
      trackingUrl,
    });

    let nextStatus = order.orderStatus;
    if (
      order.orderStatus !== "SHIPPED" &&
      order.orderStatus !== "DELIVERED" &&
      order.orderStatus !== "CANCELLED"
    ) {
      nextStatus = awbCode ? "SHIPPED" : "PROCESSING";
      await updateOrderStatusDb(order.id, nextStatus);
    }

    const updated = (await findOrderById(orderId)) as OrderWithItems;

    if (nextStatus === "SHIPPED" || nextStatus === "PROCESSING") {
      void import("@/lib/email/orders")
        .then(({ notifyOrderStatusChanged }) =>
          notifyOrderStatusChanged(updated, order.orderStatus)
        )
        .catch((err) => console.error("[email] order ship notify:", err));
    }
    if (nextStatus === "SHIPPED") {
      void import("@/lib/whatsapp")
        .then(({ notifyOrderShippedWhatsApp }) =>
          notifyOrderShippedWhatsApp(updated, trackingUrl)
        )
        .catch(() => undefined);
    }

    void import("@/lib/logging/system-log").then(({ logSuccess }) =>
      logSuccess({
        category: "stock",
        action: awbCode ? "SHIPROCKET_SHIPPED" : "SHIPROCKET_CREATED",
        message: awbCode
          ? `Order ${order.orderNumber} shipped via Shiprocket`
          : `Order ${order.orderNumber} created on Shiprocket (AWB pending)`,
        entityType: "Order",
        entityId: order.id,
        meta: { awbCode, shipmentId, mock, warning },
      })
    );

    return {
      order: updated,
      shipmentId,
      awbCode,
      trackingUrl,
      orderStatus: nextStatus,
      mock,
      warning,
    };
  } catch (err) {
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
    throw err;
  }
}
