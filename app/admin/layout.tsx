import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  FileText,
  BarChart3,
  Menu,
  Users,
  ScrollText,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { isAdminDevBypass } from "@/lib/auth/admin";

const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/tickets", label: "Tickets", icon: MessageSquare },
  { href: "/admin/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/logs", label: "Audit logs", icon: ScrollText },
];

function NavLinks() {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm hover:bg-off-white"
        >
          <Icon className="h-4 w-4 text-sage" />
          {label}
        </Link>
      ))}
      <Link
        href="/"
        className="mt-4 flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm text-muted hover:bg-off-white"
      >
        ← Back to shop
      </Link>
    </nav>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth: never render admin UI unless session role is ADMIN
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
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 pt-12">
            <SheetHeader className="px-4">
              <SheetTitle>Admin</SheetTitle>
            </SheetHeader>
            <NavLinks />
          </SheetContent>
        </Sheet>
      </header>
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-border bg-cream lg:block">
          <div className="p-5">
            <Link href="/" className="font-display text-2xl">
              Elorakart
            </Link>
            <p className="text-xs text-muted">Admin</p>
          </div>
          <NavLinks />
        </aside>
        <div className="flex-1 p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
