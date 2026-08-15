"use client";

import Link from "next/link";
import { useState } from "react";
import { LayoutDashboard, LogOut, Menu, Package, ShoppingBag, User } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { CartSheet } from "@/components/cart/cart-sheet";
import { HeaderSearch } from "@/components/layout/header-search";
import { useRouter } from "next/navigation";

const nav = [
  { href: "/sale", label: "Sale" },
  { href: "/products?category=Hair+Serum", label: "Hair and Skin" },
  { href: "/products?category=Perfume", label: "Fragrances" },
  { href: "/products", label: "Shop" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

export function SiteHeader({
  userEmail,
  userRole,
}: {
  userEmail?: string | null;
  userRole?: string | null;
}) {
  const { data: session, status } = useSession();
  const count = useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const [accountOpen, setAccountOpen] = useState(false);
  const router = useRouter();

  const user = session?.user;
  const signedIn = status === "authenticated" && Boolean(user?.email || userEmail);
  const role = user?.role || userRole;
  const isAdmin = role === "ADMIN";
  const displayName =
    user?.name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    userEmail?.split("@")[0] ||
    "Account";

  async function handleSignIn() {
    setAccountOpen(false);
    await signIn("google", { callbackUrl: "/" });
  }

  async function handleSignOut() {
    setAccountOpen(false);
    await signOut({ callbackUrl: "/" });
    router.refresh();
  }

  return (
    <header className="glass-nav sticky top-0 z-40 border-b border-border/50">
      <div className="mx-auto flex max-w-store items-center justify-between gap-3 px-4 py-3.5 md:px-6">
        <div className="flex items-center gap-2 lg:w-44">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col bg-cream p-0">
              <SheetHeader>
                <SheetTitle className="font-display text-2xl tracking-tight text-sage">
                  Elorakart
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4 pb-8">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-[44px] items-center rounded-md px-3 text-sm uppercase tracking-widest text-muted hover:bg-off-white hover:text-sage"
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="mt-4 border-t border-border pt-4">
                  {signedIn ? (
                    <>
                      <p className="px-3 text-sm font-medium">{displayName}</p>
                      <p className="px-3 text-xs text-muted">{user?.email || userEmail}</p>
                      <Link
                        href="/orders"
                        className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-off-white hover:text-sage"
                      >
                        <Package className="h-4 w-4" />
                        My Orders
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-off-white hover:text-sage"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Admin view
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-off-white hover:text-sage"
                      >
                        <LogOut className="h-4 w-4" />
                        Log out
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSignIn}
                      className="flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-off-white hover:text-sage"
                    >
                      <User className="h-4 w-4" />
                      Sign in with Google
                    </button>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
          <Link href="/" className="font-display text-2xl tracking-tight text-sage md:text-3xl">
            Elorakart
          </Link>
        </div>

        <nav className="hidden items-center gap-8 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-semibold uppercase tracking-widest text-muted transition-colors hover:text-sage"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-1 sm:gap-2 lg:min-w-44">
          <HeaderSearch />

          <div className="relative">
            {signedIn ? (
              <>
                <Button
                  variant="ghost"
                  className="hidden h-10 gap-2 px-2 sm:inline-flex"
                  onClick={() => setAccountOpen((o) => !o)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  <User className="h-4 w-4" />
                  <span className="max-w-[7rem] truncate text-sm font-medium">{displayName}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden"
                  onClick={() => setAccountOpen((o) => !o)}
                  aria-label="Account menu"
                >
                  <User className="h-5 w-5" />
                </Button>
                {accountOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40 cursor-default"
                      aria-label="Close account menu"
                      onClick={() => setAccountOpen(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-cream p-3 shadow-lg"
                    >
                      <p className="truncate text-sm font-medium">{user?.name || displayName}</p>
                      <p className="truncate text-xs text-muted">{user?.email || userEmail}</p>
                      <Link
                        href="/orders"
                        role="menuitem"
                        className="mt-3 flex min-h-[40px] w-full items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-off-white"
                        onClick={() => setAccountOpen(false)}
                      >
                        <Package className="h-4 w-4" />
                        My Orders
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          role="menuitem"
                          className="mt-2 flex min-h-[40px] w-full items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-off-white"
                          onClick={() => setAccountOpen(false)}
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          Admin view
                        </Link>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full justify-start gap-2"
                        onClick={handleSignOut}
                      >
                        <LogOut className="h-4 w-4" />
                        Log out
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <Button
                variant="ghost"
                className="h-10 gap-2 px-2"
                onClick={handleSignIn}
                disabled={status === "loading"}
                aria-label="Sign in with Google"
              >
                <User className="h-4 w-4" />
                <span className="hidden text-sm sm:inline">
                  {status === "loading" ? "…" : "Sign in"}
                </span>
              </Button>
            )}
          </div>

          <CartSheet>
            <Button variant="ghost" size="icon" className="relative" aria-label="Cart">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sage px-1 text-[10px] text-white">
                {count}
              </span>
            </Button>
          </CartSheet>
        </div>
      </div>
    </header>
  );
}
