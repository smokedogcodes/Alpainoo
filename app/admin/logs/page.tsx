import Link from "next/link";
import { requireScreenView } from "@/lib/auth/require-screen";
import { asD1, getD1, toDate } from "@/lib/db/d1";

const LEVELS = ["ERROR", "SUCCESS", "WARN", "INFO"] as const;

const TXN_TABLES = [
  { key: "all", label: "All (DbAuditLog)" },
  { key: "Order", label: "OrderAudit" },
  { key: "OrderItem", label: "OrderItemAudit" },
  { key: "Shipment", label: "ShipmentAudit" },
  { key: "Product", label: "ProductAudit" },
  { key: "User", label: "UserAudit" },
  { key: "SupportTicket", label: "SupportTicketAudit" },
] as const;

function levelBadge(level: string) {
  const styles: Record<string, string> = {
    ERROR: "bg-red-100 text-red-800",
    WARN: "bg-amber-100 text-amber-900",
    SUCCESS: "bg-sage/15 text-sage",
    INFO: "bg-off-white text-muted",
  };
  return styles[level] || styles.INFO;
}

type TxnRow = {
  id: string;
  createdAt: Date;
  operation: string;
  rowLabel: string;
  oldData: string | null;
  newData: string | null;
  source: string;
};

type AuditTableConfig = {
  table: string;
  source: string;
  rowLabel: (r: Record<string, unknown>) => string;
};

const AUDIT_CONFIG: Record<string, AuditTableConfig> = {
  Order: {
    table: "OrderAudit",
    source: "OrderAudit",
    rowLabel: (r) => (r.orderId != null ? String(r.orderId) : "—"),
  },
  OrderItem: {
    table: "OrderItemAudit",
    source: "OrderItemAudit",
    rowLabel: (r) =>
      r.orderItemId != null
        ? String(r.orderItemId)
        : r.orderId != null
          ? String(r.orderId)
          : "—",
  },
  Shipment: {
    table: "ShipmentAudit",
    source: "ShipmentAudit",
    rowLabel: (r) =>
      r.shipmentId != null
        ? String(r.shipmentId)
        : r.orderId != null
          ? String(r.orderId)
          : "—",
  },
  Product: {
    table: "ProductAudit",
    source: "ProductAudit",
    rowLabel: (r) => (r.productId != null ? String(r.productId) : "—"),
  },
  User: {
    table: "UserAudit",
    source: "UserAudit",
    rowLabel: (r) => (r.userId != null ? String(r.userId) : "—"),
  },
  SupportTicket: {
    table: "SupportTicketAudit",
    source: "SupportTicketAudit",
    rowLabel: (r) => (r.ticketId != null ? String(r.ticketId) : "—"),
  },
};

function mapTxnRow(
  r: Record<string, unknown>,
  source: string,
  rowLabel: string
): TxnRow {
  return {
    id: String(r.id),
    createdAt: toDate(r.createdAt),
    operation: String(r.operation ?? ""),
    rowLabel,
    oldData: r.oldData != null ? String(r.oldData) : null,
    newData: r.newData != null ? String(r.newData) : null,
    source,
  };
}

async function loadTxnRowsD1(
  db: D1Database,
  table: string,
  take: number,
  skip: number
): Promise<{ rows: TxnRow[]; total: number }> {
  const d1 = asD1(db);
  try {
    const config = AUDIT_CONFIG[table];
    if (config) {
      const [rowsRes, countRes] = await Promise.all([
        d1
          .prepare(
            `SELECT * FROM ${config.table} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
          )
          .bind(take, skip)
          .all(),
        d1.prepare(`SELECT COUNT(*) as c FROM ${config.table}`).first(),
      ]);
      const total = Number((countRes as { c: number } | null)?.c ?? 0);
      const rows = ((rowsRes.results || []) as Record<string, unknown>[]).map((r) =>
        mapTxnRow(r, config.source, config.rowLabel(r))
      );
      return { rows, total };
    }

    const [rowsRes, countRes] = await Promise.all([
      d1
        .prepare(
          `SELECT * FROM DbAuditLog ORDER BY createdAt DESC LIMIT ? OFFSET ?`
        )
        .bind(take, skip)
        .all(),
      d1.prepare(`SELECT COUNT(*) as c FROM DbAuditLog`).first(),
    ]);
    const total = Number((countRes as { c: number } | null)?.c ?? 0);
    const rows = ((rowsRes.results || []) as Record<string, unknown>[]).map((r) =>
      mapTxnRow(
        r,
        "DbAuditLog",
        `${String(r.tableName ?? "")}:${r.rowId != null ? String(r.rowId) : "—"}`
      )
    );
    return { rows, total };
  } catch {
    return { rows: [], total: 0 };
  }
}

async function loadTxnRowsPrisma(
  table: string,
  take: number,
  skip: number
): Promise<{ rows: TxnRow[]; total: number }> {
  try {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();

    if (table === "Order") {
      const [rows, total] = await Promise.all([
        prisma.orderAudit.findMany({ orderBy: { createdAt: "desc" }, take, skip }),
        prisma.orderAudit.count(),
      ]);
      return {
        total,
        rows: rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          operation: r.operation,
          rowLabel: r.orderId || "—",
          oldData: r.oldData,
          newData: r.newData,
          source: "OrderAudit",
        })),
      };
    }
    if (table === "OrderItem") {
      const [rows, total] = await Promise.all([
        prisma.orderItemAudit.findMany({ orderBy: { createdAt: "desc" }, take, skip }),
        prisma.orderItemAudit.count(),
      ]);
      return {
        total,
        rows: rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          operation: r.operation,
          rowLabel: r.orderItemId || r.orderId || "—",
          oldData: r.oldData,
          newData: r.newData,
          source: "OrderItemAudit",
        })),
      };
    }
    if (table === "Shipment") {
      const [rows, total] = await Promise.all([
        prisma.shipmentAudit.findMany({ orderBy: { createdAt: "desc" }, take, skip }),
        prisma.shipmentAudit.count(),
      ]);
      return {
        total,
        rows: rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          operation: r.operation,
          rowLabel: r.shipmentId || r.orderId || "—",
          oldData: r.oldData,
          newData: r.newData,
          source: "ShipmentAudit",
        })),
      };
    }
    if (table === "Product") {
      const [rows, total] = await Promise.all([
        prisma.productAudit.findMany({ orderBy: { createdAt: "desc" }, take, skip }),
        prisma.productAudit.count(),
      ]);
      return {
        total,
        rows: rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          operation: r.operation,
          rowLabel: r.productId || "—",
          oldData: r.oldData,
          newData: r.newData,
          source: "ProductAudit",
        })),
      };
    }
    if (table === "User") {
      const [rows, total] = await Promise.all([
        prisma.userAudit.findMany({ orderBy: { createdAt: "desc" }, take, skip }),
        prisma.userAudit.count(),
      ]);
      return {
        total,
        rows: rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          operation: r.operation,
          rowLabel: r.userId || "—",
          oldData: r.oldData,
          newData: r.newData,
          source: "UserAudit",
        })),
      };
    }
    if (table === "SupportTicket") {
      const [rows, total] = await Promise.all([
        prisma.supportTicketAudit.findMany({ orderBy: { createdAt: "desc" }, take, skip }),
        prisma.supportTicketAudit.count(),
      ]);
      return {
        total,
        rows: rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          operation: r.operation,
          rowLabel: r.ticketId || "—",
          oldData: r.oldData,
          newData: r.newData,
          source: "SupportTicketAudit",
        })),
      };
    }

    const [rows, total] = await Promise.all([
      prisma.dbAuditLog.findMany({ orderBy: { createdAt: "desc" }, take, skip }),
      prisma.dbAuditLog.count(),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        operation: r.operation,
        rowLabel: `${r.tableName}:${r.rowId || "—"}`,
        oldData: r.oldData,
        newData: r.newData,
        source: "DbAuditLog",
      })),
    };
  } catch {
    return { rows: [], total: 0 };
  }
}

async function loadTxnRows(
  table: string,
  take: number,
  skip: number
): Promise<{ rows: TxnRow[]; total: number }> {
  const db = await getD1();
  if (db) return loadTxnRowsD1(db, table, take, skip);
  return loadTxnRowsPrisma(table, take, skip);
}

type SystemLogRow = {
  id: string;
  createdAt: Date;
  level: string;
  category: string;
  action: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  meta: string;
};

async function loadSystemLogs(
  levelFilter: string | undefined,
  category: string | undefined,
  take: number,
  skip: number
): Promise<{ rows: SystemLogRow[]; total: number }> {
  const db = await getD1();
  if (db) {
    try {
      const d1 = asD1(db);
      const where: string[] = [];
      const binds: unknown[] = [];
      if (levelFilter) {
        where.push("level = ?");
        binds.push(levelFilter);
      }
      if (category) {
        where.push("category = ?");
        binds.push(category);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const [rowsRes, countRes] = await Promise.all([
        d1
          .prepare(
            `SELECT * FROM SystemLog ${whereSql} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
          )
          .bind(...binds, take, skip)
          .all(),
        d1
          .prepare(`SELECT COUNT(*) as c FROM SystemLog ${whereSql}`)
          .bind(...binds)
          .first(),
      ]);
      const total = Number((countRes as { c: number } | null)?.c ?? 0);
      const rows = ((rowsRes.results || []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        createdAt: toDate(r.createdAt),
        level: String(r.level ?? ""),
        category: String(r.category ?? ""),
        action: String(r.action ?? ""),
        message: String(r.message ?? ""),
        entityType: r.entityType != null ? String(r.entityType) : null,
        entityId: r.entityId != null ? String(r.entityId) : null,
        actorUserId: r.actorUserId != null ? String(r.actorUserId) : null,
        actorEmail: r.actorEmail != null ? String(r.actorEmail) : null,
        meta: String(r.meta ?? "{}"),
      }));
      return { rows, total };
    } catch {
      return { rows: [], total: 0 };
    }
  }

  try {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const where = {
      ...(levelFilter ? { level: levelFilter } : {}),
      ...(category ? { category } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.systemLog.count({ where }),
    ]);
    return { rows, total };
  } catch {
    return { rows: [], total: 0 };
  }
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: { level?: string; category?: string; tab?: string; page?: string; table?: string };
}) {
  await requireScreenView("logs");

  const tab = searchParams.tab === "db" ? "db" : "system";
  const table = searchParams.table || "all";
  const levelParam = (searchParams.level || "ERROR").toUpperCase();
  const levelFilter =
    levelParam === "ALL" ? undefined : LEVELS.includes(levelParam as (typeof LEVELS)[number]) ? levelParam : "ERROR";
  const category = searchParams.category?.trim() || undefined;
  const page = Math.max(1, Number(searchParams.page || 1) || 1);
  const take = 40;
  const skip = (page - 1) * take;

  if (tab === "db") {
    const { rows, total } = await loadTxnRows(table, take, skip);
    const pages = Math.max(1, Math.ceil(total / take));

    return (
      <div className="space-y-6">
        <Header tab={tab} level={levelParam} category={category} table={table} />
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-off-white text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Op</th>
                <th className="px-3 py-2 font-medium">Row</th>
                <th className="px-3 py-2 font-medium">Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border align-top last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                    {r.createdAt.toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.source}</td>
                  <td className="px-3 py-2">{r.operation}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.rowLabel}</td>
                  <td className="max-w-md px-3 py-2">
                    <details>
                      <summary className="cursor-pointer text-xs text-sage">View JSON</summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-off-white p-2 text-[10px] leading-snug">
                        {JSON.stringify(
                          {
                            old: r.oldData ? safeJson(r.oldData) : null,
                            new: r.newData ? safeJson(r.newData) : null,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="p-6 text-center text-muted">
              No transaction audit rows yet. Place an order or change a product to generate logs.
            </p>
          )}
        </div>
        <Pager page={page} pages={pages} baseQuery={{ tab: "db", table }} />
      </div>
    );
  }

  const { rows, total } = await loadSystemLogs(levelFilter, category, take, skip);
  const pages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="space-y-6">
      <Header tab={tab} level={levelParam} category={category} table={table} />
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border bg-off-white text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Message</th>
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">Actor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                  {r.createdAt.toLocaleString("en-IN")}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${levelBadge(r.level)}`}>
                    {r.level}
                  </span>
                </td>
                <td className="px-3 py-2">{r.category}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                <td className="max-w-sm px-3 py-2">
                  <p>{r.message}</p>
                  {r.meta && r.meta !== "{}" && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-sage">Meta</summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-off-white p-2 text-[10px]">
                        {JSON.stringify(safeJson(r.meta), null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.entityType ? (
                    <>
                      {r.entityType}
                      {r.entityId ? (
                        <span className="mt-0.5 block font-mono text-[10px] text-muted">{r.entityId}</span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted">{r.actorEmail || r.actorUserId || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-6 text-center text-muted">
            No {levelFilter ? levelFilter.toLowerCase() : ""} logs yet.
          </p>
        )}
      </div>
      <Pager
        page={page}
        pages={pages}
        baseQuery={{
          tab: "system",
          level: levelParam,
          ...(category ? { category } : {}),
        }}
      />
    </div>
  );
}

function safeJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function Header({
  tab,
  level,
  category,
  table,
}: {
  tab: string;
  level: string;
  category?: string;
  table: string;
}) {
  const filters = [
    { label: "Errors", level: "ERROR" },
    { label: "Success", level: "SUCCESS" },
    { label: "Warnings", level: "WARN" },
    { label: "All", level: "ALL" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl">Audit logs</h1>
        <p className="mt-1 text-sm text-muted">
          Application events and per-table transaction audits (OrderAudit, ShipmentAudit, …).
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/logs?level=ERROR"
          className={`rounded-md px-3 py-2 text-sm ${
            tab !== "db" ? "bg-sage text-white" : "border bg-white"
          }`}
        >
          System logs
        </Link>
        <Link
          href="/admin/logs?tab=db&table=Order"
          className={`rounded-md px-3 py-2 text-sm ${
            tab === "db" ? "bg-sage text-white" : "border bg-white"
          }`}
        >
          Transaction audits
        </Link>
      </div>
      {tab === "db" && (
        <div className="flex flex-wrap gap-2">
          {TXN_TABLES.map((t) => (
            <Link
              key={t.key}
              href={`/admin/logs?tab=db&table=${encodeURIComponent(t.key)}`}
              className={`rounded-md px-3 py-2 text-sm ${
                table === t.key ? "bg-sage text-white" : "border bg-white"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
      {tab !== "db" && (
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Link
              key={f.level}
              href={`/admin/logs?level=${f.level}${category ? `&category=${encodeURIComponent(category)}` : ""}`}
              className={`rounded-md px-3 py-2 text-sm ${
                level.toUpperCase() === f.level ? "bg-sage text-white" : "border bg-white"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Pager({
  page,
  pages,
  baseQuery,
}: {
  page: number;
  pages: number;
  baseQuery: Record<string, string>;
}) {
  if (pages <= 1) return null;
  const qs = (p: number) => {
    const params = new URLSearchParams(baseQuery);
    params.set("page", String(p));
    return `/admin/logs?${params.toString()}`;
  };
  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-muted">
        Page {page} of {pages}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={qs(page - 1)} className="rounded-md border bg-white px-3 py-1.5">
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={qs(page + 1)} className="rounded-md border bg-white px-3 py-1.5">
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
