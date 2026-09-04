"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateReturnStatus } from "@/lib/actions/returns";
import { Button } from "@/components/ui/button";

export function ReturnAdminActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(status: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      try {
        await updateReturnStatus(id, status);
        toast.success(status === "APPROVED" ? "Return approved" : "Return rejected");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={() => setStatus("APPROVED")}>
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => setStatus("REJECTED")}
      >
        Reject
      </Button>
    </div>
  );
}
