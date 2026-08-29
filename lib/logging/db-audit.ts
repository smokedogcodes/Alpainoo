import { prisma } from "@/lib/prisma";

/** App-level audit (D1 has no Postgres triggers). Best-effort; never throws. */
export async function writeDbAudit(input: {
  tableName: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | string;
  rowId?: string | null;
  oldData?: unknown;
  newData?: unknown;
}) {
  try {
    const id = `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const oldData = input.oldData == null ? null : JSON.stringify(input.oldData);
    const newData = input.newData == null ? null : JSON.stringify(input.newData);

    await prisma.dbAuditLog.create({
      data: {
        id,
        tableName: input.tableName,
        operation: input.operation,
        rowId: input.rowId || null,
        oldData,
        newData,
      },
    });

    if (input.tableName === "Order") {
      await prisma.orderAudit.create({
        data: {
          id: `oa_${id}`,
          operation: input.operation,
          orderId: input.rowId || null,
          oldData,
          newData,
        },
      });
    } else if (input.tableName === "OrderItem") {
      const orderId =
        (input.newData as { orderId?: string } | null)?.orderId ||
        (input.oldData as { orderId?: string } | null)?.orderId ||
        null;
      await prisma.orderItemAudit.create({
        data: {
          id: `oia_${id}`,
          operation: input.operation,
          orderItemId: input.rowId || null,
          orderId,
          oldData,
          newData,
        },
      });
    } else if (input.tableName === "Shipment") {
      const orderId =
        (input.newData as { orderId?: string } | null)?.orderId ||
        (input.oldData as { orderId?: string } | null)?.orderId ||
        null;
      await prisma.shipmentAudit.create({
        data: {
          id: `sa_${id}`,
          operation: input.operation,
          shipmentId: input.rowId || null,
          orderId,
          oldData,
          newData,
        },
      });
    } else if (input.tableName === "Product" || input.tableName === "StockLog") {
      const productId =
        input.tableName === "Product"
          ? input.rowId
          : (input.newData as { productId?: string } | null)?.productId ||
            (input.oldData as { productId?: string } | null)?.productId ||
            null;
      await prisma.productAudit.create({
        data: {
          id: `pa_${id}`,
          operation: input.tableName === "StockLog" ? `STOCKLOG_${input.operation}` : input.operation,
          productId: productId || null,
          oldData,
          newData,
        },
      });
    } else if (input.tableName === "User") {
      await prisma.userAudit.create({
        data: {
          id: `ua_${id}`,
          operation: input.operation,
          userId: input.rowId || null,
          oldData,
          newData,
        },
      });
    } else if (input.tableName === "SupportTicket") {
      await prisma.supportTicketAudit.create({
        data: {
          id: `ta_${id}`,
          operation: input.operation,
          ticketId: input.rowId || null,
          oldData,
          newData,
        },
      });
    }
  } catch (err) {
    console.warn("[audit] write failed:", err);
  }
}
