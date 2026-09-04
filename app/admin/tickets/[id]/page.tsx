import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { TicketAdminActions } from "@/components/admin/ticket-actions";
import { getAdminTicket } from "@/lib/db/tickets";

export default async function AdminTicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const ticket = await getAdminTicket(params.id);
  if (!ticket) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/tickets" className="text-sm text-sage underline">
          ← All tickets
        </Link>
        <h1 className="mt-2 font-display text-3xl">{ticket.ticketNumber}</h1>
        <p className="text-muted">{ticket.subject}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border bg-white p-4 text-sm">
          <h2 className="font-display text-xl">Customer</h2>
          <p>
            <span className="text-muted">Name:</span>{" "}
            {ticket.name || ticket.user?.name || "—"}
          </p>
          <p>
            <span className="text-muted">Email:</span> {ticket.email}
          </p>
          <p>
            <span className="text-muted">User ID:</span>{" "}
            {ticket.userId || ticket.user?.id || "Guest"}
          </p>
          <p>
            <span className="text-muted">Category:</span> {ticket.category}
          </p>
          <p>
            <span className="text-muted">TAT:</span> {ticket.tatHours}h · due{" "}
            {ticket.dueAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          </p>
          <p>
            <span className="text-muted">Created:</span>{" "}
            {ticket.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          </p>
        </div>
        <TicketAdminActions
          id={ticket.id}
          status={ticket.status}
          adminReply={ticket.adminReply}
        />
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <h2 className="mb-3 font-display text-xl">Ticket description / transcript snapshot</h2>
        <pre className="whitespace-pre-wrap text-sm text-foreground/90">{ticket.description}</pre>
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <h2 className="mb-3 font-display text-xl">Chat history (audit log)</h2>
        {!ticket.session?.messages?.length ? (
          <p className="text-sm text-muted">No linked chat messages.</p>
        ) : (
          <ul className="space-y-3">
            {ticket.session.messages.map((m) => (
              <li
                key={m.id}
                className="rounded border border-border/50 bg-cream px-3 py-2 text-sm"
              >
                <div className="mb-1 flex flex-wrap gap-2 text-xs text-muted">
                  <span className="font-semibold uppercase text-sage">{m.role}</span>
                  {m.source && <span>source: {m.source}</span>}
                  {m.intent && <span>intent: {m.intent}</span>}
                  <span>
                    {m.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
