"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Search, ShoppingBag, User } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { CartSheet } from "@/components/cart/cart-sheet";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/sale", label: "Sale" },
  { href: "/products?category=Hair+Serum", label: "Hair and Skin" },
  { href: "/products?category=Perfume", label: "Fragrances" },
  { href: "/products", label: "Shop" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

export function SiteHeader({ userEmail }: { userEmail?: string | null }) {
  const count = useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const onHome = pathname === "/";

  async function handleSignIn() {
    await signIn("google", { callbackUrl: "/" });
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: "/" });
    router.refresh();
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/products?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  }

  return (
    <header
      className={cn(
        "z-40",
        onHome
          ? "absolute inset-x-0 top-0 border-none bg-transparent"
          : "sticky top-0 border-b border-border/80 bg-cream/95 backdrop-blur"
      )}
    >
      <div className="mx-auto flex max-w-store items-center justify-between gap-3 px-4 py-4 md:px-6">
        <div className="flex items-center gap-2 lg:w-44">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0">
              <SheetHeader>
                <SheetTitle className="font-display text-2xl">Elorakart</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4 pb-8">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="min-h-[44px] flex items-center rounded-md px-3 text-base hover:bg-off-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <Link href="/" className="font-display text-2xl tracking-tight md:text-3xl">
            Elorakart
          </Link>
        </div>

        <nav className="hidden items-center gap-8 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm tracking-wide text-foreground/85 hover:text-sage"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-1 sm:gap-2 lg:w-44">
          {searchOpen ? (
            <form onSubmit={onSearch} className="flex items-center gap-2">
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search..."
                className="h-10 w-36 bg-cream/90 lg:w-44"
                aria-label="Search"
              />
            </form>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search className="h-5 w-5" />
            </Button>
          )}
          {userEmail ? (
            <Button variant="ghost" size="icon" onClick={handleSignOut} title={userEmail} aria-label="Sign out">
              <User className="h-5 w-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={handleSignIn} aria-label="Sign in">
              <User className="h-5 w-5" />
            </Button>
          )}
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
