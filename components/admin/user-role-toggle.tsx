"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setUserRole } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";

export function UserRoleToggle({
  userId,
  role,
  adminCount,
}: {
  userId: string;
  role: "ADMIN" | "CUSTOMER";
  adminCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isLastAdmin = role === "ADMIN" && adminCount <= 1;
  const nextRole = role === "ADMIN" ? "CUSTOMER" : "ADMIN";

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || isLastAdmin}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setUserRole(userId, nextRole);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          });
        }}
      >
        {pending ? "…" : role === "ADMIN" ? "Make customer" : "Make admin"}
      </Button>
      {isLastAdmin && <p className="text-xs text-muted">Last admin</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
