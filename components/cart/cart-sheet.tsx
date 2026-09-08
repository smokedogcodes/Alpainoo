"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/product/product-image";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/utils";
import { opaqueHref } from "@/lib/security/opaque-routes";
import { useDismissOnRouteChange } from "@/hooks/use-dismiss-on-route-change";

export function CartSheet({ children }: { children: React.ReactNode }) {
  const { items, updateQty, removeItem, subtotal } = useCart();
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const beaconSent = useRef<string>("");
  useDismissOnRouteChange(() => setOpen(false));

  useEffect(() => {
    if (!open || !items.length) return;
    const email = session?.user?.email?.trim();
    if (!email) return;
    const key = `${email}:${items.map((i) => `${i.productId}x${i.quantity}`).join(",")}`;
    if (beaconSent.current === key) return;
    beaconSent.current = key;
    void fetch("/api/abandoned-cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        items: items.map((i) => ({
          productId: i.productId,
          slug: i.slug,
          title: i.title,
          quantity: i.quantity,
          price: i.price,
        })),
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [open, items, session?.user?.email]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle>Shopping Cart</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6">
          {items.length === 0 ? (
            <p className="py-10 text-center text-muted">Your cart is empty.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.lineId} className="flex gap-3 py-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-blush-soft">
                    <ProductImage src={item.image} alt={item.title} fill sizes="80px" />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex justify-between gap-2">
                      <SheetClose asChild>
                        <Link
                          href={`/products/${item.slug}`}
                          className="text-sm font-medium leading-snug"
                        >
                          {item.title}
                        </Link>
                      </SheetClose>
                      <button
                        type="button"
                        onClick={() => removeItem(item.lineId)}
                        className="min-h-[44px] min-w-[44px] text-muted hover:text-price-sale"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center rounded-md border border-border">
                        <button
                          type="button"
                          className="flex h-10 w-10 items-center justify-center"
                          onClick={() => updateQty(item.lineId, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          className="flex h-10 w-10 items-center justify-center"
                          onClick={() => updateQty(item.lineId, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="font-semibold">{formatINR(item.price * item.quantity)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-3 border-t border-border p-6">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span className="font-semibold">{formatINR(subtotal())}</span>
          </div>
          <SheetClose asChild>
            <Button asChild variant="terracotta" className="w-full" disabled={!items.length}>
              <Link href={opaqueHref("/checkout")}>Proceed to Checkout</Link>
            </Button>
          </SheetClose>
          <p className="text-center text-xs text-muted">
            Free shipping on orders ₹499+. Coupons & delivery ETA at checkout.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
