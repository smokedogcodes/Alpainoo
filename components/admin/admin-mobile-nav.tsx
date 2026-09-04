"use client";

import Link from "next/link";
import { useState } from "react";
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
  Tag,
  FolderTree,
  Megaphone,
  Layers,
  RotateCcw,
  Star,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useDismissOnRouteChange } from "@/hooks/use-dismiss-on-route-change";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/collections", label: "Collections", icon: Layers },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/returns", label: "Returns", icon: RotateCcw },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { href: "/admin/seo", label: "SEO", icon: Search },
  { href: "/admin/tickets", label: "Tickets", icon: MessageSquare },
  { href: "/admin/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/logs", label: "Audit logs", icon: ScrollText },
];

export function AdminNavLinks({ closeOnNavigate = false }: { closeOnNavigate?: boolean }) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {links.map(({ href, label, icon: Icon }) => {
        const className =
          "flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm hover:bg-off-white";
        if (closeOnNavigate) {
          return (
            <SheetClose asChild key={href}>
              <Link href={href} className={className}>
                <Icon className="h-4 w-4 text-sage" />
                {label}
              </Link>
            </SheetClose>
          );
        }
        return (
          <Link key={href} href={href} className={className}>
            <Icon className="h-4 w-4 text-sage" />
            {label}
          </Link>
        );
      })}
      {closeOnNavigate ? (
        <SheetClose asChild>
          <Link
            href="/"
            className="mt-4 flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm text-muted hover:bg-off-white"
          >
            ← Back to shop
          </Link>
        </SheetClose>
      ) : (
        <Link
          href="/"
          className="mt-4 flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm text-muted hover:bg-off-white"
        >
          ← Back to shop
        </Link>
      )}
    </nav>
  );
}

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  useDismissOnRouteChange(() => setOpen(false));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto p-0 pt-12">
        <SheetHeader className="px-4">
          <SheetTitle>Admin</SheetTitle>
        </SheetHeader>
        <AdminNavLinks closeOnNavigate />
      </SheetContent>
    </Sheet>
  );
}
