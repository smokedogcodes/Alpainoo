import { asD1, getD1 } from "@/lib/db/d1";

/**
 * Notify admins when product stock falls at/below threshold.
 * Uses Resend when available; otherwise logs to console.
 */
export async function checkAndNotifyLowStock(productId: string) {
  if (!productId) return { notified: false as const };

  let title = "";
  let stock = 0;
  let threshold = 5;
  let sku = "";

  const db = await getD1();
  if (db) {
    const row = await asD1(db)
      .prepare(
        `SELECT title, sku, stock, lowStockThreshold FROM Product WHERE id = ? LIMIT 1`
      )
      .bind(productId)
      .first();
    if (!row) return { notified: false as const };
    title = String(row.title);
    sku = String(row.sku);
    stock = Number(row.stock);
    threshold = Number(row.lowStockThreshold ?? 5);
  } else {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return { notified: false as const };
    title = product.title;
    sku = product.sku;
    stock = product.stock;
    threshold = product.lowStockThreshold;
  }

  if (stock > threshold) return { notified: false as const, stock, threshold };

  const subject = `[Alpainoo] Low stock: ${title}`;
  const html = `<p><strong>${title}</strong> (SKU ${sku}) has <strong>${stock}</strong> units left (threshold ${threshold}).</p>`;
  const text = `${title} (SKU ${sku}) has ${stock} units left (threshold ${threshold}).`;
  const to = (process.env.ADMIN_EMAIL || "").split(",")[0]?.trim() || "elorakart1@gmail.com";

  try {
    const mod = await import("@/lib/email/resend").catch(() => null);
    if (mod && typeof mod.sendTransactionalEmail === "function") {
      await mod.sendTransactionalEmail({ to, subject, html, text });
      return { notified: true as const, stock, threshold };
    }
  } catch (err) {
    console.warn("[inventory] Resend notify failed:", err);
  }

  console.warn("[inventory] low stock:", { productId, title, sku, stock, threshold });
  return { notified: false as const, stock, threshold, logged: true as const };
}
