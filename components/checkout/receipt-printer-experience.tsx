"use client";

import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { opaqueHref } from "@/lib/security/opaque-routes";
import {
  ReceiptPrinter,
  type ReceiptPrinterStage,
} from "@/components/checkout/receipt-printer";

export type ReceiptLineItem = {
  title: string;
  quantity: number;
  price: number;
};

export type ReceiptOrderData = {
  orderId?: string;
  orderNumber: string;
  createdAt?: string;
  totalAmount?: number;
  paymentStatus?: string;
  items?: ReceiptLineItem[];
};

const PROCESSING_MS = 800;
const PRINTING_MS = 1750;

function formatReceiptDate(iso?: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function ReceiptBody({ order }: { order: ReceiptOrderData }) {
  const items = (order.items ?? []).slice(0, 6);
  const placed = formatReceiptDate(order.createdAt);
  const hasMore = (order.items?.length ?? 0) > items.length;

  return (
    <div className="relative z-10 space-y-4 text-[11px] leading-relaxed text-foreground">
      <header className="text-center">
        <p className="font-display text-2xl tracking-wide text-sage">Elorakart</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted">
          Natural skincare
        </p>
      </header>

      <div className="border-y border-dashed border-border/80 py-2 text-center">
        <p className="font-medium tracking-wide">{order.orderNumber}</p>
        {placed ? <p className="mt-0.5 text-muted">{placed}</p> : null}
      </div>

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.title}-${index}`}
              className="flex items-start justify-between gap-3"
            >
              <span className="min-w-0 flex-1 truncate">
                {item.title}
                <span className="text-muted"> ×{item.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatINR(item.price * item.quantity)}
              </span>
            </li>
          ))}
          {hasMore ? (
            <li className="text-center text-muted">+ more items on order</li>
          ) : null}
        </ul>
      ) : (
        <p className="text-center text-muted">Thank you for shopping with us.</p>
      )}

      {typeof order.totalAmount === "number" ? (
        <div className="flex items-center justify-between border-t border-dashed border-border/80 pt-2 text-sm font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatINR(order.totalAmount)}</span>
        </div>
      ) : null}

      <div className="flex justify-center pt-1">
        <span className="rotate-[-6deg] rounded border-2 border-terracotta px-3 py-1 font-display text-sm font-semibold uppercase tracking-widest text-terracotta">
          {order.paymentStatus === "PAID" || !order.paymentStatus
            ? "Paid"
            : order.paymentStatus}
        </span>
      </div>

      <p className="pt-1 text-center text-[10px] text-muted">
        Shipping updates will follow once the courier picks up your order.
      </p>
    </div>
  );
}

export function ReceiptPrinterExperience({
  order,
  playCelebration = false,
}: {
  order: ReceiptOrderData;
  playCelebration?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const storageKey = order.orderId ? `ek_rcpt_${order.orderId}` : null;
  const [allowCelebrate, setAllowCelebrate] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduceMotion || !playCelebration || !storageKey) {
      setAllowCelebrate(false);
      setReady(true);
      return;
    }
    try {
      if (window.localStorage.getItem(storageKey) === "1") {
        setAllowCelebrate(false);
      } else {
        window.localStorage.setItem(storageKey, "1");
        setAllowCelebrate(true);
      }
    } catch {
      setAllowCelebrate(playCelebration);
    }
    setReady(true);
  }, [playCelebration, reduceMotion, storageKey]);

  const skipAnimation = !ready || reduceMotion || !allowCelebrate;
  const [stage, setStage] = useState<ReceiptPrinterStage>("complete");

  useEffect(() => {
    if (!ready) return;
    if (skipAnimation) {
      setStage("complete");
      return;
    }

    setStage("processing");
    const toPrinting = window.setTimeout(() => setStage("printing"), PROCESSING_MS);
    const toComplete = window.setTimeout(
      () => setStage("complete"),
      PROCESSING_MS + PRINTING_MS,
    );

    return () => {
      window.clearTimeout(toPrinting);
      window.clearTimeout(toComplete);
    };
  }, [ready, skipAnimation, order.orderNumber]);

  return (
    <div className="relative z-0 mx-auto flex w-full max-w-lg flex-col items-center px-4 py-12 md:py-16">
      <ReceiptPrinter.Root stage={stage} className="w-full">
        <ReceiptPrinter.Machine>
          <ReceiptPrinter.Header>
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-sage">
              Elorakart
            </span>
          </ReceiptPrinter.Header>
          <ReceiptPrinter.Screen>
            <ReceiptPrinter.Status />
          </ReceiptPrinter.Screen>
        </ReceiptPrinter.Machine>

        <ReceiptPrinter.Output>
          <ReceiptPrinter.Paper>
            <ReceiptBody order={order} />
          </ReceiptPrinter.Paper>
        </ReceiptPrinter.Output>
      </ReceiptPrinter.Root>

      <div
        className={`relative z-10 mt-2 flex w-full max-w-sm flex-col items-center gap-3 transition-opacity duration-300 ${
          stage === "complete" ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={stage !== "complete"}
      >
        <p className="text-center text-sm text-muted">
          Your order has been placed
          {order.orderNumber ? (
            <>
              {" "}
              — <strong className="text-foreground">{order.orderNumber}</strong>
            </>
          ) : null}
          .
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href={opaqueHref("/products")}>Continue shopping</Link>
          </Button>
          {order.orderId ? (
            <Button asChild variant="outline">
              <Link href={opaqueHref(`/orders/${order.orderId}`)}>View order</Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={opaqueHref("/orders")}>My orders</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
