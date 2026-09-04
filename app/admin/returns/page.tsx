import { listReturns } from "@/lib/actions/returns";
import { ReturnAdminActions } from "@/components/admin/return-admin-actions";

export default async function AdminReturnsPage() {
  const returns = await listReturns(100);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Returns</h1>
      <div className="space-y-3">
        {returns.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">Order {r.orderId}</p>
                <p className="mt-1 text-sm text-muted">{r.reason}</p>
                <p className="mt-2 text-xs text-muted">
                  {r.status} · {r.createdAt.toLocaleString("en-IN")}
                </p>
                {r.adminNote && <p className="mt-1 text-xs">Note: {r.adminNote}</p>}
              </div>
              {r.status === "REQUESTED" && <ReturnAdminActions id={r.id} />}
            </div>
          </div>
        ))}
        {!returns.length && <p className="text-muted">No return requests yet.</p>}
      </div>
    </div>
  );
}
