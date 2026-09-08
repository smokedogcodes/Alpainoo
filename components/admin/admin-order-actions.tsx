"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { approveCancelRequest, rejectCancelRequest, syncShipmentTracking } from "@/lib/actions/admin";
import { refundOrder } from "@/lib/actions/refunds";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/admin/admin-permissions";

export function AdminOrderActions({
  orderId,
  cancelRequested,
  cancelReason,
  hasShipment,
  canRefund = false,
}: {
  orderId: string;
  cancelRequested: boolean;
  cancelReason?: string | null;
  hasShipment: boolean;
  canRefund?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>, okMsg: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(okMsg);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  return (
    <Can screen="orders" action="edit">
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
              onClick={() =>
                run(() => approveCancelRequest(orderId), "Cancel approved — order cancelled")
              }
            >
              Approve cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => rejectCancelRequest(orderId), "Cancel request rejected")}
            >
              Reject
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {canRefund && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Refund this paid order via Razorpay?")) return;
              run(() => refundOrder(orderId), "Refund processed successfully");
            }}
          >
            Refund
          </Button>
        )}
        {hasShipment && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => syncShipmentTracking(orderId), "Tracking synced")}
          >
            Refresh tracking
          </Button>
        )}
      </div>
    </div>
    </Can>
  );
}
