import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminMobileNav, AdminNavLinks } from "@/components/admin/admin-mobile-nav";
import { AdminPermissionsProvider } from "@/components/admin/admin-permissions";
import { getAdminAccess, isAdminDevBypass } from "@/lib/auth/admin";
import { fullMatrix } from "@/lib/auth/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let role = "ADMIN";
  let effectiveRole = "ADMIN";
  let permissions = fullMatrix();

  if (!isAdminDevBypass()) {
    const access = await getAdminAccess();
    if (!access || access.effectiveRole === "CUSTOMER") {
      redirect("/?error=unauthorized");
    }
    role = access.role;
    effectiveRole = access.effectiveRole;
    permissions = access.permissions;
  }

  return (
    <AdminPermissionsProvider
      role={role}
      effectiveRole={effectiveRole}
      permissions={permissions}
    >
      <div className="min-h-screen bg-off-white">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-cream px-4 py-3 lg:hidden">
          <Link href="/admin" className="font-display text-xl">
            Alpainoo Admin
          </Link>
          <AdminMobileNav />
        </header>
        <div className="mx-auto flex max-w-7xl">
          <aside className="sticky top-0 hidden h-screen w-56 shrink-0 overflow-y-auto border-r border-border bg-cream lg:block">
            <div className="p-5">
              <Link href="/" className="font-display text-2xl">
                Alpainoo
              </Link>
              <p className="text-xs text-muted">
                {effectiveRole === "ADMIN" ? "Admin" : effectiveRole}
              </p>
            </div>
            <AdminNavLinks />
          </aside>
          <div className="flex-1 p-4 md:p-8">{children}</div>
        </div>
      </div>
    </AdminPermissionsProvider>
  );
}
