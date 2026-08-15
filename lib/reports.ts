import { prisma } from "@/lib/prisma";
import { startOfDay, subDays, format } from "date-fns";

export async function getAnalytics() {
  const today = startOfDay(new Date());
  const paidOrders = await prisma.order.findMany({
    where: { paymentStatus: "PAID" },
    include: { items: true },
  });
  const todayOrders = paidOrders.filter((o) => o.createdAt >= today);
  const todaySales = todayOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalOrders = paidOrders.length;
  const aov = totalOrders ? paidOrders.reduce((s, o) => s + o.totalAmount, 0) / totalOrders : 0;
  const lowStock = await prisma.product.findMany({
    where: { stock: { lte: 10 }, isHidden: false },
    orderBy: { stock: "asc" },
    take: 10,
  });

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(new Date(), 13 - i);
    const key = format(d, "yyyy-MM-dd");
    const dayStart = startOfDay(d);
    const dayEnd = startOfDay(subDays(d, -1));
    const sales = paidOrders
      .filter((o) => o.createdAt >= dayStart && o.createdAt < dayEnd)
      .reduce((s, o) => s + o.totalAmount, 0);
    return { date: format(d, "MMM d"), key, sales };
  });

  const statusCounts = await prisma.order.groupBy({
    by: ["orderStatus"],
    _count: true,
  });

  const topProducts = await prisma.orderItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true, price: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5,
  });
  const productIds = topProducts.map((t) => t.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const top = topProducts.map((t) => ({
    title: products.find((p) => p.id === t.productId)?.title ?? t.productId,
    units: t._sum.quantity ?? 0,
  }));

  return {
    todaySales,
    todayOrderCount: todayOrders.length,
    totalOrders,
    aov,
    lowStock,
    revenueTrend: last14,
    statusCounts,
    topProducts: top,
  };
}

export type ReportType =
  | "users"
  | "sales"
  | "inventory"
  | "orders"
  | "products"
  | "discounts";

export async function generateReport(type: ReportType, from?: Date, to?: Date) {
  const dateFilter =
    from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {};

  switch (type) {
    case "users": {
      const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
      const spend = await prisma.order.groupBy({
        by: ["userId"],
        where: { paymentStatus: "PAID", userId: { not: null } },
        _sum: { totalAmount: true },
        _count: true,
      });
      return users.map((u) => {
        const s = spend.find((x) => x.userId === u.id);
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          createdAt: u.createdAt.toISOString(),
          orders: s?._count ?? 0,
          spend: s?._sum.totalAmount ?? 0,
        };
      });
    }
    case "sales": {
      const orders = await prisma.order.findMany({
        where: dateFilter,
        orderBy: { createdAt: "desc" },
      });
      return orders.map((o) => ({
        orderNumber: o.orderNumber,
        email: o.email,
        totalAmount: o.totalAmount,
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        createdAt: o.createdAt.toISOString(),
        razorpayOrderId: o.razorpayOrderId,
      }));
    }
    case "inventory": {
      const products = await prisma.product.findMany({ orderBy: { stock: "asc" } });
      return products.map((p) => ({
        sku: p.sku,
        title: p.title,
        brand: p.brand,
        category: p.category,
        stock: p.stock,
        mrp: p.mrp,
        stockValue: p.mrp * p.stock,
        isHidden: p.isHidden,
        lowStock: p.stock <= 10,
      }));
    }
    case "orders": {
      const orders = await prisma.order.findMany({
        where: dateFilter,
        include: { shipment: true },
        orderBy: { createdAt: "desc" },
      });
      return orders.map((o) => ({
        orderNumber: o.orderNumber,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        awb: o.shipment?.awbCode ?? "",
        courier: o.shipment?.courierName ?? "",
        trackingStatus: o.shipment?.trackingStatus ?? "",
        createdAt: o.createdAt.toISOString(),
      }));
    }
    case "products": {
      const items = await prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
      });
      const products = await prisma.product.findMany();
      return products.map((p) => {
        const sold = items.find((i) => i.productId === p.id)?._sum.quantity ?? 0;
        return {
          sku: p.sku,
          title: p.title,
          brand: p.brand,
          unitsSold: sold,
          revenueApprox: sold * p.sellingPrice,
          discount: p.discount,
          stock: p.stock,
          zeroSales: sold === 0,
        };
      });
    }
    case "discounts": {
      const products = await prisma.product.findMany({
        where: { discount: { gt: 0 } },
        orderBy: { discount: "desc" },
      });
      return products.map((p) => ({
        sku: p.sku,
        title: p.title,
        brand: p.brand,
        category: p.category,
        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        discountPercent: p.discount,
        savingsPerUnit: Math.round((p.mrp - p.sellingPrice) * 100) / 100,
        stock: p.stock,
        onSaleLive: !p.isHidden && p.stock > 0,
        isHidden: p.isHidden,
      }));
    }
  }
}

export function summarizeReport(type: ReportType, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    return [] as { label: string; value: string }[];
  }
  switch (type) {
    case "sales": {
      const total = rows.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
      const paid = rows.filter((r) => r.paymentStatus === "PAID").length;
      return [
        { label: "Orders", value: String(rows.length) },
        { label: "Paid", value: String(paid) },
        { label: "GMV", value: `₹${Math.round(total).toLocaleString("en-IN")}` },
        {
          label: "AOV",
          value: rows.length ? `₹${Math.round(total / rows.length).toLocaleString("en-IN")}` : "₹0",
        },
      ];
    }
    case "discounts": {
      const live = rows.filter((r) => r.onSaleLive === true).length;
      const avg =
        rows.reduce((s, r) => s + Number(r.discountPercent || 0), 0) / (rows.length || 1);
      const max = Math.max(...rows.map((r) => Number(r.discountPercent || 0)));
      return [
        { label: "On discount", value: String(rows.length) },
        { label: "Live on store", value: String(live) },
        { label: "Avg off", value: `${Math.round(avg)}%` },
        { label: "Max off", value: `${max}%` },
      ];
    }
    case "inventory": {
      const low = rows.filter((r) => r.lowStock === true).length;
      const value = rows.reduce((s, r) => s + Number(r.stockValue || 0), 0);
      return [
        { label: "SKUs", value: String(rows.length) },
        { label: "Low stock", value: String(low) },
        { label: "Stock value", value: `₹${Math.round(value).toLocaleString("en-IN")}` },
      ];
    }
    case "users": {
      const admins = rows.filter((r) => r.role === "ADMIN").length;
      return [
        { label: "Users", value: String(rows.length) },
        { label: "Admins", value: String(admins) },
        { label: "Customers", value: String(rows.length - admins) },
      ];
    }
    case "orders": {
      const shipped = rows.filter((r) => r.orderStatus === "SHIPPED" || r.orderStatus === "DELIVERED").length;
      const withAwb = rows.filter((r) => Boolean(r.awb)).length;
      return [
        { label: "Orders", value: String(rows.length) },
        { label: "Shipped+", value: String(shipped) },
        { label: "With AWB", value: String(withAwb) },
      ];
    }
    case "products": {
      const zero = rows.filter((r) => r.zeroSales === true).length;
      const units = rows.reduce((s, r) => s + Number(r.unitsSold || 0), 0);
      return [
        { label: "Products", value: String(rows.length) },
        { label: "Units sold", value: String(units) },
        { label: "Zero sales", value: String(zero) },
      ];
    }
    default:
      return [{ label: "Rows", value: String(rows.length) }];
  }
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h];
          const s = v == null ? "" : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}
