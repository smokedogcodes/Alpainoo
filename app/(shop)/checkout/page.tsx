"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { toast } from "sonner";
import { signIn, useSession } from "next-auth/react";
import { useCart } from "@/lib/cart";
import { formatINR } from "@/lib/utils";
import {
  amountToFreeShipping,
  calcShippingFee,
  FREE_SHIPPING_MIN,
} from "@/lib/shipping";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCheckoutOrder,
  confirmMockPayment,
  verifyAndFulfillPayment,
} from "@/lib/actions/checkout";
import { previewCoupon } from "@/lib/actions/coupons";
import { getCheckoutAddressPrefill } from "@/lib/actions/account";
import { PhoneVerify } from "@/components/account/phone-verify";
import { EmailVerifyModal } from "@/components/account/email-verify-modal";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type AppliedCoupon = {
  code: string;
  discount: number;
  total: number;
  label: string;
  description: string | null;
  freeShipping: boolean;
};

function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(-10);
  return digits;
}

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const cartSubtotal = useCart((s) => s.subtotal);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [pincodeStatus, setPincodeStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    estimate?: string;
    error?: string;
  }>({ checking: false, available: null });
  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [prefillDone, setPrefillDone] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const signedIn = status === "authenticated" && Boolean(session?.user?.id);
  const subtotalAmount = cartSubtotal();
  const merchandiseAfterCoupon = appliedCoupon?.total ?? subtotalAmount;
  const shippingAmount = appliedCoupon?.freeShipping
    ? 0
    : calcShippingFee(merchandiseAfterCoupon);
  const payableTotal = Math.round((merchandiseAfterCoupon + shippingAmount) * 100) / 100;
  const toFreeShip = amountToFreeShipping(merchandiseAfterCoupon);

  useEffect(() => {
    if (status === "loading" || prefillDone) return;
    let cancelled = false;

    async function loadPrefill() {
      if (signedIn) {
        try {
          const saved = await getCheckoutAddressPrefill();
          if (cancelled) return;
          if (saved) {
            setForm((f) => ({
              email: f.email || saved.email,
              name: f.name || saved.name,
              phone: f.phone || saved.phone,
              address: f.address || saved.address,
              city: f.city || saved.city,
              state: f.state || saved.state,
              pincode: f.pincode || saved.pincode,
            }));
            setPhoneVerified(Boolean(saved.phoneVerifiedAt && saved.phone));
            setPrefillDone(true);
            return;
          }
        } catch {
          /* fall through to session defaults */
        }
      }

      if (session?.user?.email) {
        setForm((f) => ({
          ...f,
          email: f.email || session.user?.email || "",
          name: f.name || session.user?.name || "",
        }));
      }
      setPrefillDone(true);
    }

    void loadPrefill();
    return () => {
      cancelled = true;
    };
  }, [status, signedIn, session?.user?.email, session?.user?.name, prefillDone]);

  useEffect(() => {
    if (!appliedCoupon) return;
    setAppliedCoupon(null);
    setCouponError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalAmount, items.length]);

  useEffect(() => {
    const pin = form.pincode.trim();
    if (!/^\d{6}$/.test(pin)) {
      setPincodeStatus({ checking: false, available: null });
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setPincodeStatus({ checking: true, available: null });
      try {
        const res = await fetch("/api/shipping/pincode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pincode: pin }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setPincodeStatus({ checking: false, available: false, error: data.error || "Invalid pin" });
          return;
        }
        setPincodeStatus({
          checking: false,
          available: Boolean(data.available),
          estimate: data.estimate,
          error: data.available ? undefined : "Delivery not available for this pin code",
        });
      } catch {
        if (!cancelled) {
          setPincodeStatus({ checking: false, available: null, error: "Could not check pin code" });
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.pincode]);

  const couponHint = useMemo(() => {
    if (appliedCoupon) {
      return appliedCoupon.description
        ? `${appliedCoupon.label} · ${appliedCoupon.description}`
        : appliedCoupon.label;
    }
    return null;
  }, [appliedCoupon]);

  async function onApplyCoupon() {
    const code = couponCode.trim();
    if (!code) {
      setCouponError("Enter a coupon code");
      setAppliedCoupon(null);
      return;
    }
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const result = await previewCoupon(code, subtotalAmount);
      if (!result.ok) {
        setAppliedCoupon(null);
        setCouponError(result.error);
        toast.error(result.error);
        return;
      }
      setAppliedCoupon({
        code: result.code,
        discount: result.discount,
        total: result.total,
        label: result.label,
        description: result.description,
        freeShipping: result.freeShipping,
      });
      setCouponCode(result.code);
      toast.success(`Coupon ${result.code} applied`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not apply coupon";
      setAppliedCoupon(null);
      setCouponError(msg);
      toast.error(msg);
    } finally {
      setApplyingCoupon(false);
    }
  }

  function onClearCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponCode("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) {
      toast.error("Cart is empty");
      return;
    }
    if (!signedIn) {
      toast.error("Please sign in with Google or verify your email first");
      return;
    }
    if (!phoneVerified) {
      toast.error("Please verify your mobile number before checkout");
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
    if (pincodeStatus.available === false) {
      toast.error(pincodeStatus.error || "We cannot deliver to this pin code");
      return;
    }

    setLoading(true);
    try {
      const result = await createCheckoutOrder({
        ...form,
        phone,
        pincode: form.pincode.trim(),
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          variantId: i.variantId,
        })),
        couponCode: appliedCoupon?.code || undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (result.mock || !result.key) {
        const paid = await confirmMockPayment(result.orderId, result.paymentToken);
        if (!paid.ok) {
          toast.error(paid.error);
          return;
        }
        clear();
        toast.success("Order placed (demo payment)");
        router.push(paid.successUrl);
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
        name: "Alpainoo",
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
            paymentToken: result.paymentToken,
          });
          if (!verified.ok) {
            toast.error(verified.error);
            return;
          }
          clear();
          toast.success("Payment successful");
          router.push(verified.successUrl);
        },
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-store px-4 py-10 md:px-6">
        <p className="text-muted">Loading checkout…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-store px-4 py-10 md:px-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <h1 className="font-display text-4xl">Checkout</h1>
      {!signedIn ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-cream p-4">
          <p className="text-sm text-muted">
            Verify your identity to place an order — Google sign-in, or email OTP then mobile
            verification.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/checkout" })}
            >
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmailModalOpen(true)}
            >
              Verify email with OTP
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">Signed in as {session?.user?.email}</p>
      )}

      {signedIn && !phoneVerified ? (
        <div className="mt-6 max-w-lg">
          <h2 className="font-display text-xl">Verify mobile</h2>
          <p className="mt-1 text-sm text-muted">
            We email a 4-digit code to your verified inbox before you can pay.
          </p>
          <div className="mt-3">
            <PhoneVerify
              compact
              initialPhone={form.phone}
              initiallyVerified={false}
              emailHint={session?.user?.email || form.email || undefined}
              onVerified={(phone) => {
                setForm((f) => ({ ...f, phone }));
                setPhoneVerified(true);
              }}
              onCleared={() => setPhoneVerified(false)}
            />
          </div>
        </div>
      ) : null}

      <EmailVerifyModal
        open={emailModalOpen}
        email={form.email}
        name={form.name}
        onClose={() => setEmailModalOpen(false)}
        onVerified={(verifiedEmail) => {
          setForm((f) => ({ ...f, email: verifiedEmail }));
          setEmailModalOpen(false);
          window.setTimeout(() => window.location.reload(), 400);
        }}
      />

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
              disabled={signedIn}
              readOnly={signedIn}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            {!signedIn ? (
              <p className="mt-1 text-xs text-muted">
                Use this address for email OTP, or continue with Google.
              </p>
            ) : null}
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
              disabled={!signedIn || !phoneVerified}
              readOnly={phoneVerified}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <p className="mt-1 text-xs text-muted">
              {phoneVerified
                ? "Locked to your verified mobile."
                : "Verify your mobile above to continue."}
            </p>
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
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                }))
              }
            />
            {pincodeStatus.checking ? (
              <p className="mt-1 text-xs text-muted">Checking delivery…</p>
            ) : pincodeStatus.available === true ? (
              <p className="mt-1 text-xs text-sage">
                Delivery available
                {pincodeStatus.estimate ? ` · ETA ${pincodeStatus.estimate}` : ""}
              </p>
            ) : pincodeStatus.error ? (
              <p className="mt-1 text-xs text-price-sale">{pincodeStatus.error}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="couponCode">Coupon code (optional)</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="couponCode"
                type="text"
                className="flex-1"
                value={couponCode}
                onChange={(e) => {
                  const next = e.target.value.toUpperCase();
                  setCouponCode(next);
                  if (appliedCoupon && next.trim() !== appliedCoupon.code) {
                    setAppliedCoupon(null);
                  }
                  if (couponError) setCouponError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void onApplyCoupon();
                  }
                }}
                placeholder="SAVE10"
                disabled={applyingCoupon || loading}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void onApplyCoupon()}
                disabled={applyingCoupon || loading || !couponCode.trim() || !items.length}
              >
                {applyingCoupon ? "Checking…" : "Apply"}
              </Button>
            </div>
            {couponError ? (
              <p className="mt-1.5 text-sm text-price-sale" role="alert">
                {couponError}
              </p>
            ) : null}
            {appliedCoupon && !couponError ? (
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-sm text-sage">
                <p>
                  Applied <span className="font-medium">{appliedCoupon.code}</span>
                  {couponHint ? ` — ${couponHint}` : ""}. You save{" "}
                  <span className="font-medium">{formatINR(appliedCoupon.discount)}</span>.
                </p>
                <button
                  type="button"
                  className="text-xs underline underline-offset-2 hover:text-foreground"
                  onClick={onClearCoupon}
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted">
                Enter a code and tap Apply to check if it is valid for this order.
              </p>
            )}
          </div>
          <Button
            type="submit"
            variant="terracotta"
            className="w-full"
            disabled={
              loading ||
              !items.length ||
              !signedIn ||
              !phoneVerified ||
              pincodeStatus.available === false
            }
          >
            {loading ? "Processing..." : `Pay ${formatINR(payableTotal)}`}
          </Button>
        </form>
        <aside className="h-fit rounded-lg border border-border bg-white p-5">
          <h2 className="font-display text-2xl">Order summary</h2>
          <ul className="mt-4 divide-y divide-border">
            {items.map((i) => (
              <li key={i.lineId} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={i.image || "/products/placeholder.jpg"}
                    alt=""
                    className="h-12 w-12 rounded-md bg-blush-soft object-cover"
                  />
                  <span className="truncate">
                    {i.title} × {i.quantity}
                  </span>
                </div>
                <span className="shrink-0 font-medium">{formatINR(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{formatINR(subtotalAmount)}</span>
            </div>
            {appliedCoupon ? (
              <div className="flex justify-between text-sage">
                <span>
                  Coupon ({appliedCoupon.code})
                  <span className="text-muted"> · {appliedCoupon.label}</span>
                </span>
                <span>−{formatINR(appliedCoupon.discount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted">Shipping</span>
              <span>{shippingAmount > 0 ? formatINR(shippingAmount) : "Free"}</span>
            </div>
            {toFreeShip > 0 ? (
              <p className="text-xs text-muted">
                Add {formatINR(toFreeShip)} more for free shipping (orders ₹{FREE_SHIPPING_MIN}+).
              </p>
            ) : null}
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <span>Total</span>
              <span>{formatINR(payableTotal)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
