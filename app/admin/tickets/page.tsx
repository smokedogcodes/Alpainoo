import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireAdmin();

  const where = searchParams.status ? { status: searchParams.status } : {};
  const tickets = await prisma.supportTicket.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Tickets</h1>
        <Link href="/admin/knowledge" className="text-sm text-sage underline">
          Manage FAQ knowledge base
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/tickets"
          className={`rounded-md px-3 py-2 text-sm ${!searchParams.status ? "bg-sage text-white" : "bg-white border"}`}
        >
          All
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/admin/tickets?status=${s}`}
            className={`rounded-md px-3 py-2 text-sm ${
              searchParams.status === s ? "bg-sage text-white" : "bg-white border"
            }`}
          >
            {s.replaceAll("_", " ")}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {tickets.length === 0 && (
          <p className="text-sm text-muted">No tickets yet.</p>
        )}
        {tickets.map((t) => {
          const overdue = t.status === "OPEN" || t.status === "IN_PROGRESS"
            ? t.dueAt.getTime() < Date.now()
            : false;
          return (
            <Link
              key={t.id}
              href={`/admin/tickets/${t.id}`}
              className="block rounded-lg border border-border bg-white p-4 hover:border-sage"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <div>
                  <p className="font-medium">
                    {t.ticketNumber} · {t.subject}
                  </p>
                  <p className="text-sm text-muted">
                    {t.name || "Customer"} · {t.email}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t.category} · TAT {t.tatHours}h · due{" "}
                    {t.dueAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                    {overdue ? " · OVERDUE" : ""}
                  </p>
                </div>
                <span className="h-fit rounded bg-off-white px-2 py-1 text-xs font-medium">
                  {t.status.replaceAll("_", " ")}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
