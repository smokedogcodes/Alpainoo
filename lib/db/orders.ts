import type { Order, OrderItem, Product, Shipment } from "@prisma/client";
import { asD1, cuidLike, getD1, sqlNow, toDate } from "@/lib/db/d1";
import { mapProduct } from "@/lib/db/d1-products";

export type OrderWithItems = Order & {
  items: (OrderItem & { product: Product })[];
  shipment: Shipment | null;
};

function mapOrder(row: Record<string, unknown>): Order {
  const totalAmount = Number(row.totalAmount);
  return {
    id: String(row.id),
    orderNumber: String(row.orderNumber),
    userId: row.userId != null ? String(row.userId) : null,
    email: String(row.email),
    totalAmount,
    subtotalAmount:
      row.subtotalAmount != null ? Number(row.subtotalAmount) : totalAmount,
    discountAmount: Number(row.discountAmount ?? 0),
    shippingAmount: Number(row.shippingAmount ?? 0),
    couponCode: row.couponCode != null ? String(row.couponCode) : null,
    paymentStatus: String(row.paymentStatus),
    orderStatus: String(row.orderStatus),
    razorpayOrderId:
      row.razorpayOrderId != null ? String(row.razorpayOrderId) : null,
    razorpayPaymentId:
      row.razorpayPaymentId != null ? String(row.razorpayPaymentId) : null,
    shippingAddress: String(row.shippingAddress),
    cancelRequestedAt:
      row.cancelRequestedAt != null ? toDate(row.cancelRequestedAt) : null,
    cancelReason: row.cancelReason != null ? String(row.cancelReason) : null,
    previousOrderStatus:
      row.previousOrderStatus != null ? String(row.previousOrderStatus) : null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function mapItem(row: Record<string, unknown>): OrderItem {
  return {
    id: String(row.id),
    orderId: String(row.orderId),
    productId: String(row.productId),
    variantId: row.variantId != null ? String(row.variantId) : null,
    quantity: Number(row.quantity),
    price: Number(row.price),
  };
}

function mapShipment(row: Record<string, unknown> | null): Shipment | null {
  if (!row) return null;
  return {
    id: String(row.id),
    orderId: String(row.orderId),
    shippingPartner:
      row.shippingPartner != null ? String(row.shippingPartner) : null,
    shiprocketOrderId:
      row.shiprocketOrderId != null ? String(row.shiprocketOrderId) : null,
    shipmentId: row.shipmentId != null ? String(row.shipmentId) : null,
    awbCode: row.awbCode != null ? String(row.awbCode) : null,
    courierName: row.courierName != null ? String(row.courierName) : null,
    trackingStatus:
      row.trackingStatus != null ? String(row.trackingStatus) : null,
    trackingUrl: row.trackingUrl != null ? String(row.trackingUrl) : null,
  };
}

async function loadOrderBundle(
  db: D1Database,
  orderId: string
): Promise<OrderWithItems | null> {
  const d1 = asD1(db);
  const orderRow = await d1
    .prepare("SELECT * FROM \"Order\" WHERE id = ? LIMIT 1")
    .bind(orderId)
    .first();
  if (!orderRow) return null;

  const itemsRes = await d1
    .prepare("SELECT * FROM OrderItem WHERE orderId = ?")
    .bind(orderId)
    .all();
  const itemsRaw = (itemsRes.results || []) as Record<string, unknown>[];
  const items: (OrderItem & { product: Product })[] = [];
  for (const ir of itemsRaw) {
    const item = mapItem(ir);
    const prod = await d1
      .prepare("SELECT * FROM Product WHERE id = ? LIMIT 1")
      .bind(item.productId)
      .first();
    if (!prod) continue;
    items.push({ ...item, product: mapProduct(prod as Record<string, unknown>) });
  }

  const shipRow = await d1
    .prepare("SELECT * FROM Shipment WHERE orderId = ? LIMIT 1")
    .bind(orderId)
    .first();

  return {
    ...mapOrder(orderRow as Record<string, unknown>),
    items,
    shipment: mapShipment(shipRow as Record<string, unknown> | null),
  };
}

export async function createOrderBundle(input: {
  orderNumber: string;
  userId: string;
  email: string;
  totalAmount: number;
  subtotalAmount?: number;
  discountAmount?: number;
  shippingAmount?: number;
  couponCode?: string | null;
  razorpayOrderId: string | null;
  shippingAddress: string;
  lines: Array<{ productId: string; quantity: number; price: number; variantId?: string | null }>;
}): Promise<OrderWithItems> {
  const subtotalAmount = input.subtotalAmount ?? input.totalAmount;
  const discountAmount = input.discountAmount ?? 0;
  const shippingAmount = input.shippingAmount ?? 0;
  const couponCode = input.couponCode?.trim() || null;

  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    return prisma.order.create({
      data: {
        orderNumber: input.orderNumber,
        userId: input.userId,
        email: input.email,
        totalAmount: input.totalAmount,
        subtotalAmount,
        discountAmount,
        shippingAmount,
        couponCode,
        razorpayOrderId: input.razorpayOrderId,
        shippingAddress: input.shippingAddress,
        paymentStatus: "PENDING",
        orderStatus: "PENDING",
        items: {
          create: input.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            price: l.price,
            variantId: l.variantId || null,
          })),
        },
      },
      include: { items: { include: { product: true } }, shipment: true },
    });
  }

  const d1 = asD1(db);
  const id = cuidLike();
  const now = sqlNow();
  try {
    await d1
      .prepare(
        `INSERT INTO "Order" (id, orderNumber, userId, email, totalAmount, subtotalAmount, discountAmount, shippingAmount, couponCode, paymentStatus, orderStatus, razorpayOrderId, shippingAddress, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING', ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.orderNumber,
        input.userId,
        input.email,
        input.totalAmount,
        subtotalAmount,
        discountAmount,
        shippingAmount,
        couponCode,
        input.razorpayOrderId,
        input.shippingAddress,
        now,
        now
      )
      .run();
  } catch {
    // Older D1 without commerce columns
    await d1
      .prepare(
        `INSERT INTO "Order" (id, orderNumber, userId, email, totalAmount, paymentStatus, orderStatus, razorpayOrderId, shippingAddress, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'PENDING', 'PENDING', ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.orderNumber,
        input.userId,
        input.email,
        input.totalAmount,
        input.razorpayOrderId,
        input.shippingAddress,
        now,
        now
      )
      .run();
  }

  for (const line of input.lines) {
    try {
      await d1
        .prepare(
          `INSERT INTO OrderItem (id, orderId, productId, variantId, quantity, price) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          cuidLike(),
          id,
          line.productId,
          line.variantId || null,
          line.quantity,
          line.price
        )
        .run();
    } catch {
      await d1
        .prepare(
          `INSERT INTO OrderItem (id, orderId, productId, quantity, price) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(cuidLike(), id, line.productId, line.quantity, line.price)
        .run();
    }
  }

  const bundle = await loadOrderBundle(db, id);
  if (!bundle) throw new Error("Failed to load created order");
  return bundle;
}

export async function findOrderById(orderId: string): Promise<OrderWithItems | null> {
  const db = await getD1();
  if (db) return loadOrderBundle(db, orderId);

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, shipment: true },
  });
}

export async function findOrderByRazorpayOrderId(
  razorpayOrderId: string
): Promise<OrderWithItems | null> {
  const db = await getD1();
  if (db) {
    const row = await asD1(db)
      .prepare(`SELECT id FROM "Order" WHERE razorpayOrderId = ? LIMIT 1`)
      .bind(razorpayOrderId)
      .first();
    if (!row) return null;
    return loadOrderBundle(db, String((row as { id: string }).id));
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.order.findFirst({
    where: { razorpayOrderId },
    include: { items: { include: { product: true } }, shipment: true },
  });
}

export async function listOrdersForUser(userId: string) {
  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(
        `SELECT * FROM "Order" WHERE userId = ? ORDER BY createdAt DESC`
      )
      .bind(userId)
      .all();
    const out: OrderWithItems[] = [];
    for (const row of res.results || []) {
      const bundle = await loadOrderBundle(db, String((row as { id: string }).id));
      if (bundle) out.push(bundle);
    }
    return out;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } }, shipment: true },
  });
}

/** Admin order list (optional status filter). */
export async function listAdminOrders(opts?: {
  status?: string;
}): Promise<OrderWithItems[]> {
  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    const res = opts?.status
      ? await d1
          .prepare(
            `SELECT * FROM "Order" WHERE orderStatus = ? ORDER BY createdAt DESC`
          )
          .bind(opts.status)
          .all()
      : await d1
          .prepare(`SELECT * FROM "Order" ORDER BY createdAt DESC`)
          .all();
    const out: OrderWithItems[] = [];
    for (const row of res.results || []) {
      const bundle = await loadOrderBundle(db, String((row as { id: string }).id));
      if (bundle) out.push(bundle);
    }
    return out;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.order.findMany({
    where: opts?.status ? { orderStatus: opts.status } : {},
    include: { shipment: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Mark paid + decrement stock (D1 batch or Prisma transaction). */
export async function fulfillPaidOrderDb(
  orderId: string,
  razorpayPaymentId: string
): Promise<{ order: OrderWithItems; alreadyPaid: boolean }> {
  const existing = await findOrderById(orderId);
  if (!existing) throw new Error("Order not found");
  if (existing.paymentStatus === "PAID") {
    return { order: existing, alreadyPaid: true };
  }

  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } }, shipment: true },
      });
      if (!order) throw new Error("Order not found");
      if (order.paymentStatus === "PAID") {
        return { order, alreadyPaid: true as const };
      }

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

      if (paid.couponCode) {
        const coupon = await tx.coupon.findFirst({
          where: { code: { equals: paid.couponCode } },
        });
        if (coupon) {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      return { order: paid, alreadyPaid: false as const };
    });
    return updated;
  }

  const d1 = asD1(db);
  const now = sqlNow();

  for (const item of existing.items) {
    if (item.variantId) {
      const updated = await d1
        .prepare(
          `UPDATE ProductVariant SET stock = stock - ? WHERE id = ? AND productId = ? AND stock >= ?`
        )
        .bind(item.quantity, item.variantId, item.productId, item.quantity)
        .run();
      if (!updated.meta?.changes) {
        throw new Error(`Insufficient stock for ${item.product.title}`);
      }
    }
    const updated = await d1
      .prepare(
        `UPDATE Product SET stock = stock - ?, updatedAt = ? WHERE id = ? AND stock >= ?`
      )
      .bind(item.quantity, now, item.productId, item.quantity)
      .run();
    if (!updated.meta?.changes) {
      throw new Error(`Insufficient stock for ${item.product.title}`);
    }
    await d1
      .prepare(
        `INSERT INTO StockLog (id, productId, change, note, createdAt) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        cuidLike(),
        item.productId,
        -item.quantity,
        `Order ${existing.orderNumber}`,
        now
      )
      .run();
  }

  await d1
    .prepare(
      `UPDATE "Order" SET paymentStatus = 'PAID', orderStatus = 'PAID', razorpayPaymentId = ?, updatedAt = ? WHERE id = ?`
    )
    .bind(razorpayPaymentId, now, orderId)
    .run();

  if (existing.couponCode) {
    try {
      const { redeemCoupon } = await import("@/lib/coupons");
      await redeemCoupon(existing.couponCode);
    } catch (err) {
      console.error("[coupon] redeem failed:", err);
    }
  }

  const order = await loadOrderBundle(db, orderId);
  if (!order) throw new Error("Order missing after fulfill");
  return { order, alreadyPaid: false };
}

export async function upsertShipmentD1(
  orderId: string,
  data: Partial<Shipment> & { orderId: string }
) {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    return prisma.shipment.upsert({
      where: { orderId },
      create: {
        orderId,
        shippingPartner: data.shippingPartner ?? null,
        shiprocketOrderId: data.shiprocketOrderId ?? null,
        shipmentId: data.shipmentId ?? null,
        awbCode: data.awbCode ?? null,
        courierName: data.courierName ?? null,
        trackingStatus: data.trackingStatus ?? null,
        trackingUrl: data.trackingUrl ?? null,
      },
      update: {
        shippingPartner: data.shippingPartner,
        shiprocketOrderId: data.shiprocketOrderId,
        shipmentId: data.shipmentId,
        awbCode: data.awbCode,
        courierName: data.courierName,
        trackingStatus: data.trackingStatus,
        trackingUrl: data.trackingUrl,
      },
    });
  }

  const d1 = asD1(db);
  const existing = await d1
    .prepare(`SELECT id FROM Shipment WHERE orderId = ? LIMIT 1`)
    .bind(orderId)
    .first();
  if (existing) {
    try {
      await d1
        .prepare(
          `UPDATE Shipment SET shippingPartner = ?, shiprocketOrderId = ?, shipmentId = ?, awbCode = ?, courierName = ?, trackingStatus = ?, trackingUrl = ? WHERE orderId = ?`
        )
        .bind(
          data.shippingPartner ?? null,
          data.shiprocketOrderId ?? null,
          data.shipmentId ?? null,
          data.awbCode ?? null,
          data.courierName ?? null,
          data.trackingStatus ?? null,
          data.trackingUrl ?? null,
          orderId
        )
        .run();
    } catch {
      // Column may be missing before migration 0009
      await d1
        .prepare(
          `UPDATE Shipment SET shiprocketOrderId = ?, shipmentId = ?, awbCode = ?, courierName = ?, trackingStatus = ?, trackingUrl = ? WHERE orderId = ?`
        )
        .bind(
          data.shiprocketOrderId ?? null,
          data.shipmentId ?? null,
          data.awbCode ?? null,
          data.courierName ?? null,
          data.trackingStatus ?? null,
          data.trackingUrl ?? null,
          orderId
        )
        .run();
    }
  } else {
    try {
      await d1
        .prepare(
          `INSERT INTO Shipment (id, orderId, shippingPartner, shiprocketOrderId, shipmentId, awbCode, courierName, trackingStatus, trackingUrl)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          cuidLike(),
          orderId,
          data.shippingPartner ?? null,
          data.shiprocketOrderId ?? null,
          data.shipmentId ?? null,
          data.awbCode ?? null,
          data.courierName ?? null,
          data.trackingStatus ?? null,
          data.trackingUrl ?? null
        )
        .run();
    } catch {
      await d1
        .prepare(
          `INSERT INTO Shipment (id, orderId, shiprocketOrderId, shipmentId, awbCode, courierName, trackingStatus, trackingUrl)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          cuidLike(),
          orderId,
          data.shiprocketOrderId ?? null,
          data.shipmentId ?? null,
          data.awbCode ?? null,
          data.courierName ?? null,
          data.trackingStatus ?? null,
          data.trackingUrl ?? null
        )
        .run();
    }
  }
}

export async function updateOrderStatusDb(orderId: string, orderStatus: string) {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    await prisma.order.update({
      where: { id: orderId },
      data: { orderStatus },
    });
    return;
  }
  const d1 = asD1(db);
  await d1
    .prepare(`UPDATE "Order" SET orderStatus = ?, updatedAt = ? WHERE id = ?`)
    .bind(orderStatus, sqlNow(), orderId)
    .run();
}
