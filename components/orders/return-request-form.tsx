"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requestReturn } from "@/lib/actions/returns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReturnRequestForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await requestReturn(orderId, reason);
        toast.success("Return request submitted");
        setReason("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Request failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-lg space-y-3">
      <div>
        <Label htmlFor="returnReason">Reason</Label>
        <Textarea
          id="returnReason"
          required
          minLength={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1.5"
          placeholder="Damaged, wrong item, quality issue…"
        />
      </div>
      <Button type="submit" disabled={pending || reason.trim().length < 3}>
        {pending ? "Submitting…" : "Request return"}
      </Button>
    </form>
  );
}
