"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrderStatus } from "@/lib/actions/admin";

export function OrderStatusSelect({ id, value }: { id: string; value: string }) {
  const router = useRouter();
  return (
    <select
      className="h-11 rounded-md border border-border bg-white px-3 text-sm"
      defaultValue={value}
      onChange={async (e) => {
        try {
          await updateOrderStatus(id, e.target.value);
          toast.success(`Order status updated to ${e.target.value.replaceAll("_", " ")}`);
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not update status");
        }
      }}
    >
      {[
        "PENDING",
        "PAID",
        "PROCESSING",
        "CANCEL_REQUESTED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
      ].map((s) => (
        <option key={s} value={s}>
          {s.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
