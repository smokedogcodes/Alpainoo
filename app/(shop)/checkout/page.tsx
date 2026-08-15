"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCheckoutOrder, confirmMockPayment, verifyAndFulfillPayment } from "@/lib/actions/checkout";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(-10);
  return digits;
}

export default function CheckoutPage() {
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const subtotal = useCart((s) => s.subtotal);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) {
      toast.error("Cart is empty");
      return;
    }

    const phone = normalizePhone(form.phone);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error("Enter a valid 10-digit Indian mobile number");
      return;
    }
    if (!/^\d{6}$/.test(form.pincode.trim())) {
      toast.error("Pin code must be 6 digits");
      return;
    }

    setLoading(true);
    try {
      const result = await createCheckoutOrder({
        ...form,
        phone,
        pincode: form.pincode.trim(),
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (result.mock || !result.key) {
        const paid = await confirmMockPayment(result.orderId);
        if (!paid.ok) {
          toast.error(paid.error);
          return;
        }
        clear();
        toast.success("Order placed (demo payment)");
        router.push(`/checkout/success?order=${result.orderNumber}`);
        return;
      }

      if (!window.Razorpay) {
        toast.error("Payment system is still loading. Please try again.");
        return;
      }

      const rzp = new window.Razorpay({
        key: result.key,
        amount: Math.round(result.amount * 100),
        currency: result.currency,
        name: "Elorakart",
        description: result.orderNumber,
        order_id: result.razorpayOrderId,
        prefill: { email: form.email, name: form.name, contact: phone },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verified = await verifyAndFulfillPayment({
            orderId: result.orderId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          if (!verified.ok) {
            toast.error(verified.error);
            return;
          }
          clear();
          toast.success("Payment successful");
          router.push(`/checkout/success?order=${result.orderNumber}`);
        },
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-store px-4 py-10 md:px-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <h1 className="font-display text-4xl">Checkout</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              className="mt-1.5"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              type="text"
              required
              className="mt-1.5"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              maxLength={13}
              placeholder="10-digit mobile"
              className="mt-1.5"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <p className="mt-1 text-xs text-muted">10-digit Indian mobile (e.g. 9876543210)</p>
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              type="text"
              required
              className="mt-1.5"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              type="text"
              required
              className="mt-1.5"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              type="text"
              required
              className="mt-1.5"
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="pincode">Pin code</Label>
            <Input
              id="pincode"
              type="text"
              inputMode="numeric"
              required
              maxLength={6}
              pattern="\d{6}"
              className="mt-1.5"
              value={form.pincode}
              onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
            />
          </div>
          <Button type="submit" variant="terracotta" className="w-full" disabled={loading || !items.length}>
            {loading ? "Processing..." : `Pay ${formatINR(subtotal())}`}
          </Button>
        </form>
        <aside className="rounded-lg border border-border bg-white p-5 h-fit">
          <h2 className="font-display text-2xl">Order summary</h2>
          <ul className="mt-4 divide-y divide-border">
            {items.map((i) => (
              <li key={i.productId} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={i.image || "/products/placeholder.jpg"}
                    alt=""
                    className="h-12 w-12 rounded-md object-cover bg-blush-soft"
                  />
                  <span className="truncate">
                    {i.title} × {i.quantity}
                  </span>
                </div>
                <span className="font-medium shrink-0">{formatINR(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-border pt-4 font-semibold">
            <span>Total</span>
            <span>{formatINR(subtotal())}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
