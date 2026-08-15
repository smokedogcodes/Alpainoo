"use client";

import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/lib/actions/admin";

export function OrderStatusSelect({ id, value }: { id: string; value: string }) {
  const router = useRouter();
  return (
    <select
      className="h-11 rounded-md border border-border bg-white px-3 text-sm"
      defaultValue={value}
      onChange={async (e) => {
        await updateOrderStatus(id, e.target.value);
        router.refresh();
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
      ].map((s) => (
        <option key={s} value={s}>
          {s.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
