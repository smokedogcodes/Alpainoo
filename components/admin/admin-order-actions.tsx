"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveCancelRequest, rejectCancelRequest, syncShipmentTracking } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function AdminOrderActions({
  orderId,
  cancelRequested,
  cancelReason,
  hasShipment,
}: {
  orderId: string;
  cancelRequested: boolean;
  cancelReason?: string | null;
  hasShipment: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<unknown>, okMsg: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        setMessage(okMsg);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {cancelRequested && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Cancel requested</p>
          {cancelReason && <p className="mt-0.5 text-xs">Reason: {cancelReason}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => run(() => approveCancelRequest(orderId), "Cancelled")}
            >
              Approve cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => rejectCancelRequest(orderId), "Request rejected")}
            >
              Reject
            </Button>
          </div>
        </div>
      )}
      {hasShipment && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => syncShipmentTracking(orderId), "Tracking refreshed")}
        >
          Refresh tracking
        </Button>
      )}
      {message && <p className="text-xs text-sage">{message}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
