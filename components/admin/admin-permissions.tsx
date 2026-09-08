"use client";

import { createContext, useContext } from "react";
import type { AdminScreen, PermissionAction, PermissionMatrix } from "@/lib/auth/permissions";
import { can, fullMatrix } from "@/lib/auth/permissions";

type Ctx = {
  role: string;
  effectiveRole: string;
  permissions: PermissionMatrix;
};

const AdminPermissionsContext = createContext<Ctx>({
  role: "CUSTOMER",
  effectiveRole: "CUSTOMER",
  permissions: fullMatrix(), // safe default only for missing provider in tests
});

export function AdminPermissionsProvider({
  role,
  effectiveRole,
  permissions,
  children,
}: Ctx & { children: React.ReactNode }) {
  return (
    <AdminPermissionsContext.Provider value={{ role, effectiveRole, permissions }}>
      {children}
    </AdminPermissionsContext.Provider>
  );
}

export function useAdminPermissions() {
  return useContext(AdminPermissionsContext);
}

export function useCan(screen: AdminScreen, action: PermissionAction) {
  const { effectiveRole, permissions } = useAdminPermissions();
  if (effectiveRole === "ADMIN") return true;
  return can(permissions, screen, action);
}

export function Can({
  screen,
  action,
  children,
  fallback = null,
}: {
  screen: AdminScreen;
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const allowed = useCan(screen, action);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
