import { auth } from "@/auth";
import { getRoleTemplates } from "@/lib/db/role-templates";
import {
  can,
  hasAnyAdminView,
  isStaffLikeRole,
  resolvePermissionMatrix,
  type AdminScreen,
  type PermissionAction,
  type PermissionMatrix,
  type AssignableRole,
} from "@/lib/auth/permissions";

/** Dev-only bypass — never honored in production builds */
export function isAdminDevBypass() {
  return (
    process.env.NODE_ENV === "development" && process.env.ADMIN_DEV_BYPASS === "true"
  );
}

export type AdminSessionUser = {
  id: string;
  role: AssignableRole;
  effectiveRole: AssignableRole;
  permissions: PermissionMatrix;
  roleExpiresAt: string | null;
};

async function loadSessionAccess(): Promise<AdminSessionUser | null> {
  if (isAdminDevBypass()) {
    const { fullMatrix } = await import("@/lib/auth/permissions");
    return {
      id: "dev",
      role: "ADMIN",
      effectiveRole: "ADMIN",
      permissions: fullMatrix(),
      roleExpiresAt: null,
    };
  }

  try {
    const session = await auth();
    if (!session?.user?.id) return null;

    const role = (session.user.role || "CUSTOMER") as AssignableRole;
    const permissionsJson =
      (session.user as { permissions?: string }).permissions ?? "[]";
    const roleExpiresAt =
      (session.user as { roleExpiresAt?: string | null }).roleExpiresAt ?? null;

    const templates = await getRoleTemplates();
    const resolved = resolvePermissionMatrix({
      role,
      permissionsJson,
      roleExpiresAt,
      templates,
    });

    return {
      id: session.user.id,
      role,
      effectiveRole: resolved.effectiveRole,
      permissions: resolved.matrix,
      roleExpiresAt,
    };
  } catch (err) {
    console.error("[auth] loadSessionAccess failed:", err);
    return null;
  }
}

/** True Admin only (user management, role templates). */
export async function requireAdmin() {
  const user = await loadSessionAccess();
  if (!user || user.effectiveRole !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdminApi() {
  const user = await loadSessionAccess();
  if (!user || user.effectiveRole !== "ADMIN") {
    return null;
  }
  return user;
}

/** Staff/Temp/Admin with capability check. */
export async function requirePermission(screen: AdminScreen, action: PermissionAction) {
  const user = await loadSessionAccess();
  if (!user || user.effectiveRole === "CUSTOMER") {
    throw new Error("Unauthorized");
  }
  if (user.effectiveRole === "ADMIN") return user;
  if (!can(user.permissions, screen, action)) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requirePermissionApi(
  screen: AdminScreen,
  action: PermissionAction
) {
  try {
    return await requirePermission(screen, action);
  } catch {
    return null;
  }
}

/** Any admin-area access (ADMIN or Staff/Temp with at least one view). */
export async function requireAdminAreaAccess() {
  const user = await loadSessionAccess();
  if (!user || user.effectiveRole === "CUSTOMER") {
    throw new Error("Unauthorized");
  }
  if (user.effectiveRole === "ADMIN") return user;
  if (!hasAnyAdminView(user.permissions)) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function getAdminAccess(): Promise<AdminSessionUser | null> {
  try {
    return await loadSessionAccess();
  } catch {
    return null;
  }
}

export function sessionAllowsAdminArea(input: {
  role?: string | null;
  permissions?: string | null;
  roleExpiresAt?: string | null;
}): boolean {
  if (isAdminDevBypass()) return true;
  if (!isStaffLikeRole(input.role)) return false;
  const resolved = resolvePermissionMatrix({
    role: input.role || "CUSTOMER",
    permissionsJson: input.permissions,
    roleExpiresAt: input.roleExpiresAt,
  });
  return resolved.effectiveRole === "ADMIN" || resolved.effectiveRole === "STAFF" || resolved.effectiveRole === "TEMP";
}
