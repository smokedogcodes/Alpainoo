import type { Order, OrderItem, Product } from "@prisma/client";
import { asD1, getD1, toDate } from "@/lib/db/d1";
import { formatINR } from "@/lib/utils";

export type SiteSettingsRow = {
  id: string;
  gstin: string | null;
  businessName: string | null;
  businessAddress: string | null;
  invoicePrefix: string;
  lowStockDefault: number;
  metaPixelId: string | null;
  gaMeasurementId: string | null;
};

const DEFAULTS: SiteSettingsRow = {
  id: "default",
  gstin: null,
  businessName: "Alpainoo",
  businessAddress: null,
  invoicePrefix: "ALP",
  lowStockDefault: 5,
  metaPixelId: null,
  gaMeasurementId: null,
};

function mapSettings(row: Record<string, unknown>): SiteSettingsRow {
  return {
    id: String(row.id ?? "default"),
    gstin: row.gstin != null ? String(row.gstin) : null,
    businessName: row.businessName != null ? String(row.businessName) : "Alpainoo",
    businessAddress: row.businessAddress != null ? String(row.businessAddress) : null,
    invoicePrefix: String(row.invoicePrefix ?? "ALP"),
    lowStockDefault: Number(row.lowStockDefault ?? 5),
    metaPixelId: row.metaPixelId != null ? String(row.metaPixelId) : null,
    gaMeasurementId: row.gaMeasurementId != null ? String(row.gaMeasurementId) : null,
  };
}

export async function getSiteSettings(): Promise<SiteSettingsRow> {
  const db = await getD1();
  if (db) {
    try {
      const row = await asD1(db)
        .prepare(`SELECT * FROM SiteSettings WHERE id = 'default' LIMIT 1`)
        .first();
      if (row) return mapSettings(row as Record<string, unknown>);
    } catch {
      /* table may be missing on older D1 */
    }
    return DEFAULTS;
  }

  try {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const row = await prisma.siteSettings.findUnique({ where: { id: "default" } });
    if (row) return row;
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

export async function saveSiteSettings(input: Partial<SiteSettingsRow>) {
  const current = await getSiteSettings();
  const next: SiteSettingsRow = {
    id: "default",
    gstin: input.gstin !== undefined ? input.gstin : current.gstin,
    businessName: input.businessName !== undefined ? input.businessName : current.businessName,
    businessAddress:
      input.businessAddress !== undefined ? input.businessAddress : current.businessAddress,
    invoicePrefix: input.invoicePrefix ?? current.invoicePrefix,
    lowStockDefault:
      input.lowStockDefault != null ? Number(input.lowStockDefault) : current.lowStockDefault,
    metaPixelId: input.metaPixelId !== undefined ? input.metaPixelId : current.metaPixelId,
    gaMeasurementId:
      input.gaMeasurementId !== undefined ? input.gaMeasurementId : current.gaMeasurementId,
  };

  const db = await getD1();
  if (db) {
    const existing = await asD1(db)
      .prepare(`SELECT id FROM SiteSettings WHERE id = 'default' LIMIT 1`)
      .first()
      .catch(() => null);
    if (existing) {
      await asD1(db)
        .prepare(
          `UPDATE SiteSettings SET gstin = ?, businessName = ?, businessAddress = ?,
           invoicePrefix = ?, lowStockDefault = ?, metaPixelId = ?, gaMeasurementId = ?
           WHERE id = 'default'`
        )
        .bind(
          next.gstin,
          next.businessName,
          next.businessAddress,
          next.invoicePrefix,
          next.lowStockDefault,
          next.metaPixelId,
          next.gaMeasurementId
        )
        .run();
    } else {
      await asD1(db)
        .prepare(
          `INSERT INTO SiteSettings (id, gstin, businessName, businessAddress, invoicePrefix, lowStockDefault, metaPixelId, gaMeasurementId)
           VALUES ('default', ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          next.gstin,
          next.businessName,
          next.businessAddress,
          next.invoicePrefix,
          next.lowStockDefault,
          next.metaPixelId,
          next.gaMeasurementId
        )
        .run();
    }
    return next;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.siteSettings.upsert({
    where: { id: "default" },
    create: next,
    update: {
      gstin: next.gstin,
      businessName: next.businessName,
      businessAddress: next.businessAddress,
      invoicePrefix: next.invoicePrefix,
      lowStockDefault: next.lowStockDefault,
      metaPixelId: next.metaPixelId,
      gaMeasurementId: next.gaMeasurementId,
    },
  });
}

type InvoiceOrder = Order & {
  items: (OrderItem & { product: Pick<Product, "title" | "sku"> })[];
};

type Address = {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export async function buildInvoiceHtml(order: InvoiceOrder): Promise<string> {
  const settings = await getSiteSettings();
  let address: Address = {};
  try {
    address = JSON.parse(order.shippingAddress) as Address;
  } catch {
    address = {};
  }

  const created =
    order.createdAt instanceof Date
      ? order.createdAt
      : toDate(order.createdAt);

  const invoiceNo = `${settings.invoicePrefix}-${order.orderNumber}`;
  const taxable = order.totalAmount / 1.18;
  const gst = order.totalAmount - taxable;

  const rows = order.items
    .map(
      (item, i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e2dc;">${i + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e2dc;">${escapeHtml(item.product.title)}<br/><span style="color:#666;font-size:12px;">${escapeHtml(item.product.sku)}</span></td>
        <td style="padding:8px;border-bottom:1px solid #e5e2dc;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e2dc;text-align:right;">${formatINR(item.price)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e2dc;text-align:right;">${formatINR(item.price * item.quantity)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Invoice ${escapeHtml(invoiceNo)}</title></head>
<body style="font-family:Georgia,serif;background:#f7f4ef;color:#1a2e28;margin:0;padding:24px;">
  <div style="max-width:720px;margin:0 auto;background:#fffaf3;border:1px solid #e5e2dc;padding:32px;">
    <h1 style="font-size:28px;margin:0 0 4px;">${escapeHtml(settings.businessName || "Alpainoo")}</h1>
    <p style="margin:0;color:#5a6b64;font-size:13px;">Tax Invoice (GST)</p>
    ${settings.gstin ? `<p style="margin:8px 0 0;font-size:13px;">GSTIN: ${escapeHtml(settings.gstin)}</p>` : ""}
    ${settings.businessAddress ? `<p style="margin:4px 0 0;font-size:13px;color:#5a6b64;">${escapeHtml(settings.businessAddress)}</p>` : ""}

    <div style="display:flex;justify-content:space-between;margin-top:28px;gap:24px;flex-wrap:wrap;">
      <div>
        <p style="margin:0;font-size:12px;text-transform:uppercase;color:#5a6b64;">Bill to</p>
        <p style="margin:4px 0 0;">${escapeHtml(address.name || order.email)}</p>
        <p style="margin:2px 0;font-size:13px;color:#5a6b64;">${escapeHtml(address.address || "")}</p>
        <p style="margin:2px 0;font-size:13px;color:#5a6b64;">${escapeHtml([address.city, address.state, address.pincode].filter(Boolean).join(", "))}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:13px;"><strong>Invoice:</strong> ${escapeHtml(invoiceNo)}</p>
        <p style="margin:4px 0;font-size:13px;"><strong>Order:</strong> ${escapeHtml(order.orderNumber)}</p>
        <p style="margin:4px 0;font-size:13px;"><strong>Date:</strong> ${created.toLocaleDateString("en-IN")}</p>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-top:28px;font-size:14px;">
      <thead>
        <tr style="background:#f0ebe3;">
          <th style="padding:8px;text-align:left;">#</th>
          <th style="padding:8px;text-align:left;">Item</th>
          <th style="padding:8px;text-align:center;">Qty</th>
          <th style="padding:8px;text-align:right;">Rate</th>
          <th style="padding:8px;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="margin-top:20px;text-align:right;font-size:14px;">
      <p style="margin:4px 0;">Taxable value: ${formatINR(taxable)}</p>
      <p style="margin:4px 0;">GST (18% incl.): ${formatINR(gst)}</p>
      <p style="margin:12px 0 0;font-size:18px;"><strong>Total: ${formatINR(order.totalAmount)}</strong></p>
    </div>
    <p style="margin-top:32px;font-size:12px;color:#5a6b64;">This is a computer-generated invoice. Amounts are inclusive of GST where applicable.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
