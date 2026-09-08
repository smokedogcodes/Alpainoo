"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PermissionMatrixEditor } from "@/components/admin/permission-matrix-editor";
import { setUserAccess } from "@/lib/actions/admin";
import {
  emptyMatrix,
  parsePermissionMatrix,
  type AssignableRole,
  type PermissionMatrix,
} from "@/lib/auth/permissions";

export function UserAccessEditor({
  userId,
  role,
  permissionsJson,
  roleExpiresAt,
  adminCount,
  staffTemplate,
  tempTemplate,
  layout = "stacked",
}: {
  userId: string;
  role: string;
  permissionsJson: string;
  roleExpiresAt: string | null;
  adminCount: number;
  staffTemplate: PermissionMatrix;
  tempTemplate: PermissionMatrix;
  layout?: "stacked" | "inline";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  const initialOverride = useMemo(
    () => parsePermissionMatrix(permissionsJson),
    [permissionsJson]
  );

  const [selectedRole, setSelectedRole] = useState<AssignableRole>(
    (["ADMIN", "STAFF", "TEMP", "CUSTOMER"].includes(role)
      ? role
      : "CUSTOMER") as AssignableRole
  );
  const [useDefaults, setUseDefaults] = useState(!initialOverride);
  const [matrix, setMatrix] = useState<PermissionMatrix>(
    () =>
      initialOverride ??
      (role === "TEMP" ? structuredClone(tempTemplate) : structuredClone(staffTemplate))
  );
  const [expiresAt, setExpiresAt] = useState(() => {
    if (!roleExpiresAt) return "";
    const d = new Date(roleExpiresAt);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const isLastAdmin = role === "ADMIN" && adminCount <= 1;
  const isStaffOrTemp = selectedRole === "STAFF" || selectedRole === "TEMP";
  const hasPermissionPanel = isStaffOrTemp && (!useDefaults || initialOverride !== null);

  function applyTemplate(kind: "STAFF" | "TEMP") {
    setUseDefaults(false);
    setMatrix(
      structuredClone(kind === "STAFF" ? staffTemplate : tempTemplate)
    );
  }

  function onRoleChange(next: AssignableRole) {
    setSelectedRole(next);
    if (next === "STAFF" && useDefaults) setMatrix(structuredClone(staffTemplate));
    if (next === "TEMP" && useDefaults) setMatrix(structuredClone(tempTemplate));
  }

  function saveAccess() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        const iso =
          selectedRole === "TEMP" && expiresAt
            ? new Date(expiresAt).toISOString()
            : null;
        await setUserAccess({
          userId,
          role: selectedRole,
          permissions: useDefaults ? null : matrix,
          roleExpiresAt: iso,
          useRoleDefaults: useDefaults,
        });
        setSuccess(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  const roleFields = (
    <>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Role</span>
        <select
          className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          value={selectedRole}
          disabled={pending || isLastAdmin}
          onChange={(e) => onRoleChange(e.target.value as AssignableRole)}
        >
          <option value="CUSTOMER">Customer</option>
          <option value="STAFF">Staff</option>
          <option value="TEMP">Temp</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>

      {selectedRole === "TEMP" && (
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Expires</span>
          <input
            type="datetime-local"
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            value={expiresAt}
            disabled={pending}
            onChange={(e) => setExpiresAt(e.target.value)}
            required
          />
        </label>
      )}
    </>
  );

  const saveButton = (
    <Button
      type="button"
      size="sm"
      className={layout === "inline" ? "h-9" : undefined}
      disabled={pending || isLastAdmin}
      onClick={saveAccess}
    >
      {pending ? "Saving…" : layout === "inline" ? "Save" : "Save access"}
    </Button>
  );

  const statusMessages = (
    <>
      {isLastAdmin && <p className="text-xs text-muted">Last admin — cannot demote</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
      {success && !error && <p className="text-xs text-sage">Saved</p>}
    </>
  );

  const permissionsPanel = isStaffOrTemp && (
    <div className="space-y-2">
      {layout === "inline" ? (
        <button
          type="button"
          className="text-xs text-sage underline"
          onClick={() => setShowPermissions((v) => !v)}
        >
          {showPermissions || hasPermissionPanel ? "Hide" : "Show"} permissions
        </button>
      ) : null}
      {(layout === "stacked" || showPermissions || hasPermissionPanel) && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-sage"
              checked={useDefaults}
              disabled={pending}
              onChange={(e) => {
                setUseDefaults(e.target.checked);
                if (e.target.checked) {
                  setMatrix(
                    structuredClone(
                      selectedRole === "TEMP" ? tempTemplate : staffTemplate
                    )
                  );
                }
              }}
            />
            Use role defaults
          </label>
          {!useDefaults && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => applyTemplate("STAFF")}
                >
                  Apply Staff template
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => applyTemplate("TEMP")}
                >
                  Apply Temp template
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setMatrix(emptyMatrix())}
                >
                  Clear all
                </Button>
              </div>
              <PermissionMatrixEditor
                value={matrix}
                onChange={setMatrix}
                hideAdminOnlyScreens
                disabled={pending}
              />
            </>
          )}
        </>
      )}
    </div>
  );

  if (layout === "inline") {
    return (
      <div className="w-full shrink-0 space-y-2 lg:w-auto lg:min-w-[280px]">
        <div className="flex flex-wrap items-end justify-end gap-2 sm:gap-3">
          {roleFields}
          {saveButton}
        </div>
        <div className="text-right">{statusMessages}</div>
        {permissionsPanel && (
          <div className="mt-2 rounded-md border border-border bg-off-white/50 p-3 lg:min-w-[320px]">
            {permissionsPanel}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-off-white/50 p-3">
      <div className="flex flex-wrap items-end gap-3">{roleFields}</div>
      {permissionsPanel}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {saveButton}
        {statusMessages}
      </div>
    </div>
  );
}
