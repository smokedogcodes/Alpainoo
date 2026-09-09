"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpOrbitInput } from "@/components/account/otp-orbit-input";

type Props = {
  open: boolean;
  email: string;
  name?: string;
  onClose: () => void;
  onVerified: (email: string) => void;
};

export function EmailVerifyModal({ open, email, name, onClose, onVerified }: Props) {
  const [otpStep, setOtpStep] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [localEmail, setLocalEmail] = useState(email);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLocalEmail(email);
      setOtpStep(false);
      setMessage(null);
      setCooldown(0);
    }
  }, [open, email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  if (!open) return null;

  async function sendOtp() {
    const trimmed = localEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/email/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (typeof data.cooldownSeconds === "number") setCooldown(data.cooldownSeconds);
        toast.error(data.error || "Could not send code");
        return;
      }
      setLocalEmail(trimmed);
      setOtpStep(true);
      setCooldown(data.cooldownSeconds || 60);
      setMessage(`Code sent to ${trimmed}. Enter it below.`);
      toast.success("Verification code sent");
    } catch {
      toast.error("Could not send code");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(code: string) {
    try {
      const res = await fetch("/api/email/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: localEmail.trim().toLowerCase(),
          otp: code,
          name: name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.ticket) {
        return { ok: false, error: data.error || "Incorrect code" };
      }

      const signed = await signIn("email-otp", {
        email: data.email,
        ticket: data.ticket,
        redirect: false,
      });
      if (signed?.error) {
        return { ok: false, error: "Could not start your session. Try again." };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not verify" };
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,#2c2a26_45%,transparent)] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-otp-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-cream p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="email-otp-title" className="font-display text-2xl">
              Verify email
            </h2>
            <p className="mt-1 text-sm text-muted">
              We send a 4-digit code to your inbox. After this, Google login with the same
              email will open this account.
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-muted underline underline-offset-2"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="email-otp-address" className="text-sm font-medium">
              Email
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Input
                id="email-otp-address"
                type="email"
                value={localEmail}
                disabled={otpStep && cooldown > 0}
                onChange={(e) => setLocalEmail(e.target.value)}
                className="min-w-[12rem] flex-1"
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
                      : "Send code"}
              </Button>
            </div>
          </div>

          {message ? <p className="text-xs text-sage">{message}</p> : null}

          {otpStep ? (
            <div>
              <p className="mb-2 text-sm font-medium">Enter code</p>
              <OtpOrbitInput
                onComplete={verifyCode}
                onVerified={() => {
                  toast.success("Email verified");
                  onVerified(localEmail.trim().toLowerCase());
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
