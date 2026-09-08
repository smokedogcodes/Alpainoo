"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { UserAccessEditor } from "@/components/admin/user-access-editor";
import { parsePermissionMatrix, type PermissionMatrix } from "@/lib/auth/permissions";

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  permissions: string;
  roleExpiresAt: string | null;
  createdAt: string;
};

type RoleFilter = "ALL" | "ADMIN" | "STAFF" | "TEMP" | "CUSTOMER";

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "ADMIN", label: "Admin" },
  { id: "STAFF", label: "Staff" },
  { id: "TEMP", label: "Temp" },
  { id: "CUSTOMER", label: "Customer" },
];

function roleBadgeClass(role: string) {
  if (role === "ADMIN") return "bg-sage/15 text-sage";
  if (role === "STAFF" || role === "TEMP") return "bg-amber-50 text-amber-900";
  return "bg-off-white text-muted";
}

function isExpiredTemp(user: AdminUserRow) {
  if (user.role !== "TEMP" || !user.roleExpiresAt) return false;
  const exp = new Date(user.roleExpiresAt);
  return !Number.isNaN(exp.getTime()) && exp.getTime() <= Date.now();
}

function hasCustomOverrides(user: AdminUserRow) {
  return parsePermissionMatrix(user.permissions) !== null;
}

export function UsersList({
  users,
  adminCount,
  staffTemplate,
  tempTemplate,
}: {
  users: AdminUserRow[];
  adminCount: number;
  staffTemplate: PermissionMatrix;
  tempTemplate: PermissionMatrix;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [overridesOnly, setOverridesOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (expiredOnly && !isExpiredTemp(u)) return false;
      if (overridesOnly && !hasCustomOverrides(u)) return false;
      if (!q) return true;
      const name = (u.name || "").toLowerCase();
      const email = u.email.toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [users, search, roleFilter, expiredOnly, overridesOnly]);

  const pillClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm ${
      active ? "bg-sage text-white" : "border border-border bg-white"
    }`;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border bg-white p-4">
        <Input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={pillClass(roleFilter === f.id)}
              onClick={() => setRoleFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            className={pillClass(expiredOnly)}
            onClick={() => setExpiredOnly((v) => !v)}
          >
            Expired Temp
          </button>
          <button
            type="button"
            className={pillClass(overridesOnly)}
            onClick={() => setOverridesOnly((v) => !v)}
          >
            Custom overrides
          </button>
        </div>
        <p className="text-xs text-muted">
          Showing {filtered.length} of {users.length} users
        </p>
      </div>

      <div className="space-y-3">
        {filtered.map((u) => (
          <div key={u.id} className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{u.name || "—"}</p>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${roleBadgeClass(u.role)}`}
                  >
                    {u.role}
                  </span>
                  {hasCustomOverrides(u) && (
                    <span className="rounded-md bg-sage/10 px-2 py-0.5 text-xs text-sage">
                      Custom permissions
                    </span>
                  )}
                  {isExpiredTemp(u) && (
                    <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs text-red-800">
                      Expired
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">{u.email}</p>
                <p className="mt-1 text-xs text-muted">
                  Joined {new Date(u.createdAt).toLocaleDateString("en-IN")}
                  {u.role === "TEMP" && u.roleExpiresAt
                    ? ` · expires ${new Date(u.roleExpiresAt).toLocaleString("en-IN")}`
                    : ""}
                </p>
              </div>
              <UserAccessEditor
                userId={u.id}
                role={u.role}
                permissionsJson={u.permissions}
                roleExpiresAt={u.roleExpiresAt}
                adminCount={adminCount}
                staffTemplate={staffTemplate}
                tempTemplate={tempTemplate}
                layout="inline"
              />
            </div>
          </div>
        ))}
        {!filtered.length && (
          <p className="p-6 text-center text-muted">
            {users.length ? "No users match your filters." : "No users yet. Sign in with Google first."}
          </p>
        )}
      </div>
    </div>
  );
}
