import { asD1, getD1, sqlNow } from "@/lib/db/d1";

/** App-level audit. Best-effort; never throws. */
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
    const now = sqlNow();

    const db = await getD1();
    if (db) {
      const d1 = asD1(db);
      await d1
        .prepare(
          `INSERT INTO DbAuditLog (id, createdAt, tableName, operation, rowId, oldData, newData)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, now, input.tableName, input.operation, input.rowId || null, oldData, newData)
        .run();

      if (input.tableName === "Order") {
        await d1
          .prepare(
            `INSERT INTO OrderAudit (id, createdAt, operation, orderId, oldData, newData)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(`oa_${id}`, now, input.operation, input.rowId || null, oldData, newData)
          .run();
      } else if (input.tableName === "Product" || input.tableName === "StockLog") {
        const productId =
          input.tableName === "Product"
            ? input.rowId
            : (input.newData as { productId?: string } | null)?.productId ||
              (input.oldData as { productId?: string } | null)?.productId ||
              null;
        await d1
          .prepare(
            `INSERT INTO ProductAudit (id, createdAt, operation, productId, oldData, newData)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(
            `pa_${id}`,
            now,
            input.tableName === "StockLog" ? `STOCKLOG_${input.operation}` : input.operation,
            productId || null,
            oldData,
            newData
          )
          .run();
      } else if (input.tableName === "User") {
        await d1
          .prepare(
            `INSERT INTO UserAudit (id, createdAt, operation, userId, oldData, newData)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(`ua_${id}`, now, input.operation, input.rowId || null, oldData, newData)
          .run();
      } else if (input.tableName === "SupportTicket") {
        await d1
          .prepare(
            `INSERT INTO SupportTicketAudit (id, createdAt, operation, ticketId, oldData, newData)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(`ta_${id}`, now, input.operation, input.rowId || null, oldData, newData)
          .run();
      }
      return;
    }

    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
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
          operation:
            input.tableName === "StockLog" ? `STOCKLOG_${input.operation}` : input.operation,
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
