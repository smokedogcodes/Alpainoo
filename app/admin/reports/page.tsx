"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReportType } from "@/lib/reports";

const TYPES: { id: ReportType; label: string; hint: string }[] = [
  { id: "sales", label: "Sales", hint: "Orders & GMV" },
  { id: "discounts", label: "Sale products", hint: "Active discounts" },
  { id: "inventory", label: "Inventory", hint: "Stock & value" },
  { id: "orders", label: "Fulfillment", hint: "AWB & status" },
  { id: "products", label: "Products", hint: "Bestsellers" },
  { id: "users", label: "Users", hint: "Accounts" },
];

const LABELS: Record<string, string> = {
  orderNumber: "Order #",
  email: "Email",
  totalAmount: "Amount (₹)",
  paymentStatus: "Payment",
  orderStatus: "Status",
  createdAt: "Created",
  razorpayOrderId: "Razorpay order",
  sku: "SKU",
  title: "Title",
  brand: "Brand",
  category: "Category",
  stock: "Stock",
  mrp: "MRP",
  sellingPrice: "Selling",
  discountPercent: "Discount %",
  savingsPerUnit: "Save / unit",
  onSaleLive: "Live on sale",
  isHidden: "Hidden",
  stockValue: "Stock value",
  lowStock: "Low stock",
  awb: "AWB",
  courier: "Courier",
  trackingStatus: "Tracking",
  unitsSold: "Units sold",
  revenueApprox: "Revenue ≈",
  discount: "Discount %",
  zeroSales: "Zero sales",
  name: "Name",
  role: "Role",
  orders: "Orders",
  spend: "Spend",
  id: "ID",
};

function prettyHeader(key: string) {
  return LABELS[key] || key;
}

function chartDataFor(type: ReportType, rows: Record<string, unknown>[]) {
  if (type === "discounts") {
    return rows.slice(0, 8).map((r) => ({
      name: String(r.title || r.sku).slice(0, 14),
      value: Number(r.discountPercent || 0),
    }));
  }
  if (type === "sales") {
    const byStatus: Record<string, number> = {};
    rows.forEach((r) => {
      const k = String(r.paymentStatus || "UNKNOWN");
      byStatus[k] = (byStatus[k] || 0) + 1;
    });
    return Object.entries(byStatus).map(([name, value]) => ({ name, value }));
  }
  if (type === "inventory") {
    return rows.slice(0, 8).map((r) => ({
      name: String(r.sku).slice(0, 10),
      value: Number(r.stock || 0),
    }));
  }
  return [];
}

function summarizeClient(type: ReportType, rows: Record<string, unknown>[]) {
  if (!rows.length) return [] as { label: string; value: string }[];
  if (type === "sales") {
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
  if (type === "discounts") {
    const live = rows.filter((r) => r.onSaleLive === true || r.onSaleLive === "true").length;
    const avg = rows.reduce((s, r) => s + Number(r.discountPercent || 0), 0) / rows.length;
    const max = Math.max(...rows.map((r) => Number(r.discountPercent || 0)));
    return [
      { label: "On discount", value: String(rows.length) },
      { label: "Live on store", value: String(live) },
      { label: "Avg off", value: `${Math.round(avg)}%` },
      { label: "Max off", value: `${max}%` },
    ];
  }
  if (type === "inventory") {
    const low = rows.filter((r) => r.lowStock === true || r.lowStock === "true").length;
    const value = rows.reduce((s, r) => s + Number(r.stockValue || 0), 0);
    return [
      { label: "SKUs", value: String(rows.length) },
      { label: "Low stock", value: String(low) },
      { label: "Stock value", value: `₹${Math.round(value).toLocaleString("en-IN")}` },
    ];
  }
  if (type === "users") {
    const admins = rows.filter((r) => r.role === "ADMIN").length;
    return [
      { label: "Users", value: String(rows.length) },
      { label: "Admins", value: String(admins) },
      { label: "Customers", value: String(rows.length - admins) },
    ];
  }
  if (type === "orders") {
    const shipped = rows.filter((r) => r.orderStatus === "SHIPPED" || r.orderStatus === "DELIVERED").length;
    const withAwb = rows.filter((r) => Boolean(r.awb)).length;
    return [
      { label: "Orders", value: String(rows.length) },
      { label: "Shipped+", value: String(shipped) },
      { label: "With AWB", value: String(withAwb) },
    ];
  }
  if (type === "products") {
    const zero = rows.filter((r) => r.zeroSales === true || r.zeroSales === "true").length;
    const units = rows.reduce((s, r) => s + Number(r.unitsSold || 0), 0);
    return [
      { label: "Products", value: String(rows.length) },
      { label: "Units sold", value: String(units) },
      { label: "Zero sales", value: String(zero) },
    ];
  }
  return [{ label: "Rows", value: String(rows.length) }];
}

export default function AdminReportsPage() {
  const [type, setType] = useState<ReportType>("sales");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [pending, startTransition] = useTransition();

  const headers = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);
  const summary = useMemo(() => summarizeClient(type, rows), [type, rows]);
  const chart = useMemo(() => chartDataFor(type, rows), [type, rows]);

  function load(nextType = type) {
    startTransition(async () => {
      const params = new URLSearchParams({ type: nextType });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/admin/reports?${params}`);
      const data = await res.json();
      setRows(data.rows || []);
    });
  }

  useEffect(() => {
    load(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function downloadCsv() {
    const params = new URLSearchParams({ type, format: "csv" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    window.location.href = `/api/admin/reports?${params}`;
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Reports</h1>
          <p className="text-sm text-muted">
            Business insights with CSV export.{" "}
            <Link href="/sale" className="text-sage underline underline-offset-2">
              View live sale page
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => load()} disabled={pending}>
            {pending ? "Loading..." : "Refresh"}
          </Button>
          <Button variant="outline" onClick={downloadCsv} disabled={!rows.length}>
            Download CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()} disabled={!rows.length}>
            Print / PDF
          </Button>
        </div>
      </div>

      <div className="no-print grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setType(t.id);
              load(t.id);
            }}
            className={`rounded-lg border p-4 text-left transition ${
              type === t.id
                ? "border-sage bg-sage text-white shadow-sm"
                : "border-border bg-white hover:border-sage/50"
            }`}
          >
            <p className="font-display text-xl">{t.label}</p>
            <p className={`mt-1 text-xs ${type === t.id ? "text-white/80" : "text-muted"}`}>{t.hint}</p>
          </button>
        ))}
      </div>

      <div className="no-print grid gap-4 rounded-lg border border-border bg-white p-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1.5" />
        </div>
      </div>

      {summary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summary.map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-white p-4">
              <p className="text-xs text-muted">{s.label}</p>
              <p className="mt-1 font-display text-2xl">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {chart.length > 0 && (
        <div className="no-print rounded-lg border border-border bg-white p-4">
          <h2 className="font-display text-xl mb-3">
            {type === "discounts" ? "Discount depth" : type === "sales" ? "Payment mix" : "Quick chart"}
          </h2>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#738c69" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="print-area overflow-x-auto rounded-lg border border-border bg-white">
        <div className="border-b border-border p-4">
          <h2 className="font-display text-2xl">
            {TYPES.find((t) => t.id === type)?.label || type} report
          </h2>
          <p className="text-xs text-muted">
            {from || "Start"} → {to || "Now"} · {rows.length} rows
            {pending ? " · refreshing…" : ""}
          </p>
        </div>
        {!rows.length ? (
          <p className="p-6 text-sm text-muted">No rows for this report yet.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-off-white">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="p-3 font-medium whitespace-nowrap">
                    {prettyHeader(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-border hover:bg-off-white/60">
                  {headers.map((h) => (
                    <td key={h} className="p-3 align-top whitespace-nowrap">
                      {String(row[h] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
