import Link from "next/link";
import type { User } from "@prisma/client";
import { UsersList } from "@/components/admin/users-list";
import { requireAdmin } from "@/lib/auth/admin";
import { segmentUsers } from "@/lib/crm/segments";
import { listUsers } from "@/lib/db/users";
import { getRoleTemplates } from "@/lib/db/role-templates";
import { formatINR } from "@/lib/utils";

export default async function AdminUsersPage() {
  await requireAdmin();

  const [users, segments, templates] = await Promise.all([
    listUsers(),
    segmentUsers(),
    getRoleTemplates(),
  ]);

  const adminCount = users.filter((u: User) => u.role === "ADMIN").length;
  const repeatBuyers = segments.filter((s) => s.segment === "repeat_buyer");
  const highValue = segments.filter((s) => s.segment === "high_value");

  const userRows = users.map((u: User) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    permissions: u.permissions,
    roleExpiresAt: u.roleExpiresAt ? u.roleExpiresAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Users</h1>
        <p className="mt-1 text-sm text-muted">
          Assign Admin, Staff, or Temp roles. Staff and Temp can only use screens and actions you
          enable. Manage default matrices on{" "}
          <Link href="/admin/roles" className="text-sage underline">
            Role defaults
          </Link>
          .
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Segments</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-white p-4">
            <h3 className="text-sm font-medium text-sage">Repeat buyers</h3>
            <ul className="mt-3 divide-y divide-border text-sm">
              {repeatBuyers.slice(0, 20).map((s) => (
                <li key={`rb-${s.email}`} className="flex justify-between gap-3 py-2">
                  <span className="truncate">{s.email}</span>
                  <span className="shrink-0 text-muted">{s.orderCount} orders</span>
                </li>
              ))}
              {!repeatBuyers.length && (
                <li className="py-2 text-muted">No repeat buyers yet.</li>
              )}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-white p-4">
            <h3 className="text-sm font-medium text-sage">High value (₹5,000+)</h3>
            <ul className="mt-3 divide-y divide-border text-sm">
              {highValue.slice(0, 20).map((s) => (
                <li key={`hv-${s.email}`} className="flex justify-between gap-3 py-2">
                  <span className="truncate">{s.email}</span>
                  <span className="shrink-0 text-muted">{formatINR(s.totalSpend)}</span>
                </li>
              ))}
              {!highValue.length && (
                <li className="py-2 text-muted">No high-value shoppers yet.</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <UsersList
        users={userRows}
        adminCount={adminCount}
        staffTemplate={templates.STAFF}
        tempTemplate={templates.TEMP}
      />
    </div>
  );
}
