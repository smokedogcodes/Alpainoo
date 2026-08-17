import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/admin";

const LEVELS = ["ERROR", "SUCCESS", "WARN", "INFO"] as const;

function levelBadge(level: string) {
  const styles: Record<string, string> = {
    ERROR: "bg-red-100 text-red-800",
    WARN: "bg-amber-100 text-amber-900",
    SUCCESS: "bg-sage/15 text-sage",
    INFO: "bg-off-white text-muted",
  };
  return styles[level] || styles.INFO;
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: { level?: string; category?: string; tab?: string; page?: string };
}) {
  await requireAdmin();

  const tab = searchParams.tab === "db" ? "db" : "system";
  const levelParam = (searchParams.level || "ERROR").toUpperCase();
  const levelFilter =
    levelParam === "ALL" ? undefined : LEVELS.includes(levelParam as (typeof LEVELS)[number]) ? levelParam : "ERROR";
  const category = searchParams.category?.trim() || undefined;
  const page = Math.max(1, Number(searchParams.page || 1) || 1);
  const take = 40;
  const skip = (page - 1) * take;

  if (tab === "db") {
    const [rows, total] = await Promise.all([
      prisma.dbAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.dbAuditLog.count(),
    ]);
    const pages = Math.max(1, Math.ceil(total / take));

    return (
      <div className="space-y-6">
        <Header tab={tab} level={levelParam} category={category} />
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-off-white text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Table</th>
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
                  <td className="px-3 py-2 font-medium">{r.tableName}</td>
                  <td className="px-3 py-2">{r.operation}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.rowId || "—"}</td>
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
          {!rows.length && <p className="p-6 text-center text-muted">No DB audit rows yet.</p>}
        </div>
        <Pager page={page} pages={pages} baseQuery={{ tab: "db" }} />
      </div>
    );
  }

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
  const pages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="space-y-6">
      <Header tab={tab} level={levelParam} category={category} />
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
                  {(r.path || r.method) && (
                    <p className="mt-1 text-[11px] text-muted">
                      {[r.method, r.path].filter(Boolean).join(" ")}
                    </p>
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
}: {
  tab: string;
  level: string;
  category?: string;
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
          Application errors and success events, plus database trigger audits.
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
          href="/admin/logs?tab=db"
          className={`rounded-md px-3 py-2 text-sm ${
            tab === "db" ? "bg-sage text-white" : "border bg-white"
          }`}
        >
          DB audits
        </Link>
      </div>
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
