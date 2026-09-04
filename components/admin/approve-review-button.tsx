"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { approveReview } from "@/lib/actions/reviews";
import { Button } from "@/components/ui/button";

export function ApproveReviewButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await approveReview(id);
            toast.success("Review approved");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        })
      }
    >
      Approve
    </Button>
  );
}
