import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/admin";
import { UserRoleToggle } from "@/components/admin/user-role-toggle";

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      image: true,
    },
  });

  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Users</h1>
        <p className="mt-1 text-sm text-muted">
          Roles are stored in the database. Promote or demote admins here.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-off-white text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.name || "—"}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      u.role === "ADMIN" ? "bg-sage/15 text-sage" : "bg-off-white text-muted"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">
                  {u.createdAt.toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  <UserRoleToggle
                    userId={u.id}
                    role={u.role as "ADMIN" | "CUSTOMER"}
                    adminCount={adminCount}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && (
          <p className="p-6 text-center text-muted">No users yet. Sign in with Google first.</p>
        )}
      </div>

      <p className="text-xs text-muted">
        Back to{" "}
        <Link href="/admin" className="text-sage underline">
          overview
        </Link>
        .
      </p>
    </div>
  );
}
