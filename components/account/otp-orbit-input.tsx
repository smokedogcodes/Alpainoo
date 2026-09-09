"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "verifying" | "orbiting" | "verified" | "error";

type Props = {
  disabled?: boolean;
  onComplete: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onVerified?: () => void;
};

const LENGTH = 4;
const ORBIT_MS = 1400;

export function OtpOrbitInput({ disabled, onComplete, onVerified }: Props) {
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const submitting = useRef(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    refs.current[0]?.focus();
  }, []);

  function focusAt(i: number) {
    const idx = Math.max(0, Math.min(LENGTH - 1, i));
    setActive(idx);
    refs.current[idx]?.focus();
  }

  async function submitCode(code: string) {
    if (submitting.current || disabled) return;
    submitting.current = true;
    setPhase("verifying");
    setError(null);
    try {
      const result = await onComplete(code);
      if (!result.ok) {
        setPhase("error");
        setError(result.error || "Incorrect code");
        setDigits((d) => {
          const next = [...d];
          next[LENGTH - 1] = "";
          return next;
        });
        focusAt(LENGTH - 1);
        return;
      }

      if (reduceMotion.current) {
        setPhase("verified");
        onVerified?.();
        return;
      }

      setPhase("orbiting");
      window.setTimeout(() => {
        setPhase("verified");
        onVerified?.();
      }, ORBIT_MS);
    } catch {
      setPhase("error");
      setError("Could not verify. Try again.");
      focusAt(LENGTH - 1);
    } finally {
      submitting.current = false;
    }
  }

  function applyDigits(next: string[], startFocus: number) {
    setDigits(next);
    const filled = next.every((d) => d.length === 1);
    if (filled) {
      void submitCode(next.join(""));
      return;
    }
    focusAt(startFocus);
  }

  function onChangeAt(index: number, raw: string) {
    if (phase === "orbiting" || phase === "verified" || phase === "verifying") return;
    if (phase === "error") setPhase("idle");

    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setDigits((d) => {
        const next = [...d];
        next[index] = "";
        return next;
      });
      return;
    }

    if (cleaned.length > 1) {
      // Paste into this box (or multi-digit)
      const chars = cleaned.slice(0, LENGTH).split("");
      const next = Array(LENGTH).fill("");
      for (let i = 0; i < chars.length; i++) next[i] = chars[i];
      applyDigits(next, Math.min(chars.length, LENGTH - 1));
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    applyDigits(next, index + 1);
  }

  function onKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        setDigits((d) => {
          const next = [...d];
          next[index] = "";
          return next;
        });
        setPhase("idle");
        return;
      }
      if (index > 0) {
        setDigits((d) => {
          const next = [...d];
          next[index - 1] = "";
          return next;
        });
        focusAt(index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(index + 1);
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    const next = Array(LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    applyDigits(next, Math.min(pasted.length, LENGTH - 1));
  }

  if (phase === "verified") {
    return (
      <div className="otp-orbit-root otp-orbit-verified-only" aria-live="polite">
        <div className="otp-orbit-verified-tile">Verified</div>
      </div>
    );
  }

  return (
    <div
      className={[
        "otp-orbit-root",
        phase === "orbiting" ? "is-orbiting" : "",
        phase === "error" ? "is-error" : "",
        phase === "verifying" ? "is-verifying" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="otp-orbit-hub" aria-hidden />
      <div className="otp-orbit-row" onPaste={onPaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={[
              "otp-orbit-box",
              `otp-orbit-box-${i}`,
              active === i ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={LENGTH}
            value={digit}
            disabled={disabled || phase === "orbiting" || phase === "verifying"}
            aria-label={`Digit ${i + 1} of ${LENGTH}`}
            onFocus={() => setActive(i)}
            onChange={(e) => onChangeAt(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
          />
        ))}
      </div>
      {error ? <p className="mt-2 text-xs text-price-sale">{error}</p> : null}
      {phase === "verifying" ? (
        <p className="mt-2 text-xs text-muted">Checking code…</p>
      ) : null}
    </div>
  );
}
