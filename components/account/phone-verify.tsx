"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/admin/field-label";
import { OtpOrbitInput } from "@/components/account/otp-orbit-input";
import { clearPhoneVerification } from "@/lib/actions/account";
import { toLocal10 } from "@/lib/phone";

type Props = {
  initialPhone?: string;
  initiallyVerified?: boolean;
  emailHint?: string;
  onVerified?: (phone: string) => void;
  onCleared?: () => void;
  compact?: boolean;
};

export function PhoneVerify({
  initialPhone = "",
  initiallyVerified = false,
  emailHint,
  onVerified,
  onCleared,
  compact = false,
}: Props) {
  const [phone, setPhone] = useState(initialPhone);
  const [verified, setVerified] = useState(initiallyVerified);
  const [verifiedPhone, setVerifiedPhone] = useState(
    initiallyVerified ? toLocal10(initialPhone) || "" : ""
  );
  const [otpStep, setOtpStep] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPhone(initialPhone);
    setVerified(initiallyVerified);
    if (initiallyVerified) {
      setVerifiedPhone(toLocal10(initialPhone) || "");
      setOtpStep(false);
    }
  }, [initialPhone, initiallyVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  async function sendOtp() {
    const local = toLocal10(phone);
    if (!local) {
      toast.error("Enter a valid 10-digit Indian mobile number");
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: local }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (typeof data.cooldownSeconds === "number") setCooldown(data.cooldownSeconds);
        toast.error(data.error || "Could not send code");
        return;
      }
      setPhone(local);
      setOtpStep(true);
      setCooldown(data.cooldownSeconds || 60);
      setMessage(
        `Code sent to ${emailHint || "your Google email"}. Enter it below.`
      );
      toast.success("Verification code sent");
    } catch {
      toast.error("Could not send code");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(code: string) {
    const local = toLocal10(phone);
    if (!local) return { ok: false, error: "Invalid phone" };
    try {
      const res = await fetch("/api/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: local, otp: code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || "Incorrect code" };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not verify" };
    }
  }

  if (verified && verifiedPhone) {
    return (
      <div
        className={
          compact
            ? "space-y-2"
            : "space-y-3 rounded-lg border border-border bg-cream p-4"
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">Mobile</p>
          <span className="rounded-sm bg-[color-mix(in_srgb,var(--sage)_18%,transparent)] px-2 py-0.5 text-xs text-sage">
            Verified
          </span>
        </div>
        <p className="text-sm">{verifiedPhone}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void (async () => {
              try {
                await clearPhoneVerification();
              } catch {
                /* still allow local re-verify UI */
              }
              setVerified(false);
              setVerifiedPhone("");
              setOtpStep(false);
              setMessage(null);
              onCleared?.();
            })();
          }}
        >
          Change number
        </Button>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "space-y-3"
          : "space-y-3 rounded-lg border border-border bg-cream p-4"
      }
    >
      <div>
        <FieldLabel htmlFor="verify-phone">Mobile number</FieldLabel>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Input
            id="verify-phone"
            type="tel"
            inputMode="numeric"
            maxLength={13}
            placeholder="10-digit mobile"
            value={phone}
            disabled={otpStep && cooldown > 0}
            onChange={(e) => setPhone(e.target.value)}
            className="min-w-[10rem] flex-1"
          />
          <Button
            type="button"
            onClick={() => void sendOtp()}
            disabled={sending || cooldown > 0}
          >
            {sending
              ? "Sending…"
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : otpStep
                  ? "Resend code"
                  : "Verify phone"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted">
          We email a 4-digit code to your verified inbox
          {emailHint ? ` (${emailHint})` : ""}.
        </p>
      </div>

      {message ? <p className="text-xs text-sage">{message}</p> : null}

      {otpStep ? (
        <div>
          <p className="mb-2 text-sm font-medium">Enter code</p>
          <OtpOrbitInput
            onComplete={verifyCode}
            onVerified={() => {
              const local = toLocal10(phone) || phone;
              setVerified(true);
              setVerifiedPhone(local);
              setOtpStep(false);
              toast.success("Phone verified");
              onVerified?.(local);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
