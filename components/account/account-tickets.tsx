type TicketRow = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  category: string;
  adminReply: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function statusClass(status: string) {
  if (status === "RESOLVED" || status === "CLOSED") return "bg-sage/15 text-sage";
  if (status === "IN_PROGRESS") return "bg-amber-50 text-amber-900";
  return "bg-off-white text-muted";
}

export function AccountTickets({ tickets }: { tickets: TicketRow[] }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl">Support tickets</h2>
        <p className="mt-1 text-sm text-muted">
          Updates and resolutions from Alpainoo support. You also receive these by email.
        </p>
      </div>

      {tickets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-cream p-6 text-sm text-muted">
          No tickets yet. Open the chat bubble on any shop page if you need help.
        </p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <li key={t.id} className="rounded-lg border border-border bg-cream p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {t.ticketNumber} · {t.subject}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t.category} · opened{" "}
                    {t.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                    {" · updated "}
                    {t.updatedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-medium ${statusClass(t.status)}`}
                >
                  {t.status.replaceAll("_", " ")}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{t.description}</p>

              {t.adminReply ? (
                <div className="mt-3 rounded-md border border-sage/30 bg-white p-3">
                  <p className="text-xs font-medium text-sage">Support reply</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{t.adminReply}</p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">Waiting for a support reply…</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
