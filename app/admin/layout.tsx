import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminMobileNav, AdminNavLinks } from "@/components/admin/admin-mobile-nav";
import { auth } from "@/auth";
import { isAdminDevBypass } from "@/lib/auth/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isAdminDevBypass()) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      redirect(session?.user ? "/?error=unauthorized" : "/?error=login");
    }
  }

  return (
    <div className="min-h-screen bg-off-white">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-cream px-4 py-3 lg:hidden">
        <Link href="/admin" className="font-display text-xl">
          Elorakart Admin
        </Link>
        <AdminMobileNav />
      </header>
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 overflow-y-auto border-r border-border bg-cream lg:block">
          <div className="p-5">
            <Link href="/" className="font-display text-2xl">
              Elorakart
            </Link>
            <p className="text-xs text-muted">Admin</p>
          </div>
          <AdminNavLinks />
        </aside>
        <div className="flex-1 p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
