"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestOrderCancel } from "@/lib/actions/orders";
import { Button } from "@/components/ui/button";

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Request cancellation
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-off-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await requestOrderCancel(orderId, reason);
            setOpen(false);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not submit request");
          }
        });
      }}
    >
      <label className="block text-sm font-medium" htmlFor={`cancel-${orderId}`}>
        Why do you want to cancel?
      </label>
      <textarea
        id={`cancel-${orderId}`}
        className="min-h-[88px] w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        required
        minLength={3}
        placeholder="Brief reason (min 3 characters)"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || reason.trim().length < 3}>
          {pending ? "Submitting…" : "Submit cancel request"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Back
        </Button>
      </div>
    </form>
  );
}
