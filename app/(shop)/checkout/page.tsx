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
    setLoading(true);
    try {
      const result = await createCheckoutOrder({
        ...form,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });

      if (result.mock || !result.key) {
        // #region agent log
        fetch("http://127.0.0.1:7376/ingest/6e190034-3568-4fc1-85eb-6c282aded999", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "b3f0a8",
          },
          body: JSON.stringify({
            sessionId: "b3f0a8",
            timestamp: Date.now(),
            runId: "post-fix",
            hypothesisId: "checkout-esm",
            location: "checkout/page.tsx",
            message: "Checkout createOrder succeeded (mock path)",
            data: { mock: true, hasOrderId: Boolean(result.orderId) },
          }),
        }).catch(() => {});
        // #endregion
        await confirmMockPayment(result.orderId);
        clear();
        toast.success("Order placed (demo payment)");
        router.push(`/checkout/success?order=${result.orderNumber}`);
        return;
      }

      const rzp = new window.Razorpay!({
        key: result.key,
        amount: Math.round(result.amount * 100),
        currency: result.currency,
        name: "Elorakart",
        description: result.orderNumber,
        order_id: result.razorpayOrderId,
        prefill: { email: form.email, name: form.name, contact: form.phone },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifyAndFulfillPayment({
              orderId: result.orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            clear();
            toast.success("Payment successful");
            router.push(`/checkout/success?order=${result.orderNumber}`);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Payment verification failed");
          }
        },
      });
      rzp.open();
    } catch (err) {
      // #region agent log
      fetch("http://127.0.0.1:7376/ingest/6e190034-3568-4fc1-85eb-6c282aded999", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "b3f0a8",
        },
        body: JSON.stringify({
          sessionId: "b3f0a8",
          timestamp: Date.now(),
          runId: "post-fix",
          hypothesisId: "checkout-esm",
          location: "checkout/page.tsx",
          message: "Checkout failed",
          data: {
            errMsg: err instanceof Error ? err.message.slice(0, 160) : "unknown",
          },
        }),
      }).catch(() => {});
      // #endregion
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
          {(
            [
              ["email", "Email", "email"],
              ["name", "Full name", "text"],
              ["phone", "Phone", "tel"],
              ["address", "Address", "text"],
              ["city", "City", "text"],
              ["state", "State", "text"],
              ["pincode", "Pin code", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key}>
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type={type}
                required
                className="mt-1.5"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
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
