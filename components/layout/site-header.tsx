"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutDashboard, LogOut, Menu, Package, ShoppingBag, User } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { CartSheet } from "@/components/cart/cart-sheet";
import { HeaderSearch } from "@/components/layout/header-search";
import { useDismissOnRouteChange } from "@/hooks/use-dismiss-on-route-change";
import { opaqueHref } from "@/lib/security/opaque-routes";
import { useRouter } from "next/navigation";

const nav = [
  { href: opaqueHref("/sale"), label: "Sale" },
  { href: opaqueHref("/products?category=Hair+Serum"), label: "Hair and Skin" },
  { href: opaqueHref("/products?category=Perfume"), label: "Fragrances" },
  { href: opaqueHref("/products"), label: "Shop" },
  { href: opaqueHref("/blog"), label: "Blog" },
  { href: opaqueHref("/about"), label: "About" },
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
  const [navOpen, setNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const accountBtnRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useDismissOnRouteChange(() => {
    setNavOpen(false);
    setAccountOpen(false);
  });

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!accountOpen) return;

    function placeMenu() {
      const el = accountBtnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }

    placeMenu();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountOpen(false);
    }
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  const user = session?.user;
  const signedIn = status === "authenticated" && Boolean(user?.email || userEmail);
  const isAdmin = userRole === "ADMIN" || user?.role === "ADMIN";
  const displayName =
    user?.name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    userEmail?.split("@")[0] ||
    "Account";

  async function handleSignIn() {
    setAccountOpen(false);
    setNavOpen(false);
    await signIn("google", { callbackUrl: "/" });
  }

  async function handleSignOut() {
    setAccountOpen(false);
    setNavOpen(false);
    await signOut({ callbackUrl: "/" });
    router.refresh();
  }

  function goOrders() {
    setAccountOpen(false);
    setNavOpen(false);
    router.push(opaqueHref("/orders"));
  }

  return (
    <header className="glass-nav sticky top-0 z-[100] border-b border-border/50">
      <div className="mx-auto flex max-w-store items-center justify-between gap-3 px-4 py-3.5 md:px-6">
        <div className="flex items-center gap-2 lg:w-44">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col overflow-y-auto bg-cream p-0">
              <SheetHeader>
                <SheetTitle className="font-display text-2xl tracking-tight text-sage">
                  Alpainoo
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4 pb-8">
                {nav.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className="flex min-h-[44px] items-center rounded-md px-3 text-sm uppercase tracking-widest text-muted hover:bg-off-white hover:text-sage"
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                {isAdmin && (
                  <SheetClose asChild>
                    <Link
                      href="/admin"
                      className="mt-2 flex min-h-[44px] items-center gap-2 rounded-md bg-sage/10 px-3 text-sm font-semibold text-sage hover:bg-sage/15"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Admin Dashboard
                    </Link>
                  </SheetClose>
                )}
                <div className="mt-4 border-t border-border pt-4">
                  {signedIn ? (
                    <>
                      <p className="px-3 text-sm font-medium">{displayName}</p>
                      <p className="px-3 text-xs text-muted">{user?.email || userEmail}</p>
                      <button
                        type="button"
                        onClick={goOrders}
                        className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-off-white hover:text-sage"
                      >
                        <Package className="h-4 w-4" />
                        My Orders
                      </button>
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
            Alpainoo
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
          {isAdmin && (
            <Link
              href="/admin"
              className="text-xs font-semibold uppercase tracking-widest text-sage transition-colors hover:text-sage/80"
            >
              Admin Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center justify-end gap-1 sm:gap-2 lg:min-w-44">
          <HeaderSearch />

          {isAdmin && (
            <Link
              href="/admin"
              className="hidden h-10 items-center gap-1.5 rounded-md bg-sage px-3 text-xs font-semibold uppercase tracking-wide text-white hover:bg-sage/90 sm:inline-flex"
            >
              <LayoutDashboard className="h-4 w-4" />
              Admin
            </Link>
          )}

          <div className="relative" ref={accountBtnRef}>
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
                {accountOpen && portalReady
                  ? createPortal(
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-[200] cursor-default bg-transparent"
                          aria-label="Close account menu"
                          onClick={() => setAccountOpen(false)}
                        />
                        <div
                          role="menu"
                          className="fixed z-[210] w-56 rounded-lg border border-border bg-cream p-3 shadow-lg"
                          style={{ top: menuPos.top, right: menuPos.right }}
                        >
                          <p className="truncate text-sm font-medium">{user?.name || displayName}</p>
                          <p className="truncate text-xs text-muted">{user?.email || userEmail}</p>
                          <button
                            type="button"
                            role="menuitem"
                            className="mt-3 flex min-h-[40px] w-full items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-off-white"
                            onClick={goOrders}
                          >
                            <Package className="h-4 w-4" />
                            My Orders
                          </button>
                          {isAdmin && (
                            <Link
                              href="/admin"
                              role="menuitem"
                              className="mt-2 flex min-h-[40px] w-full items-center gap-2 rounded-md border border-sage/30 bg-sage/10 px-3 text-sm font-medium text-sage hover:bg-sage/15"
                              onClick={() => setAccountOpen(false)}
                            >
                              <LayoutDashboard className="h-4 w-4" />
                              Admin Dashboard
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
                      </>,
                      document.body,
                    )
                  : null}
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
