"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateTicketStatus, replyToTicket } from "@/lib/actions/tickets";
import { AdminFormActions } from "@/components/admin/admin-form";
import { Button } from "@/components/ui/button";

const statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export function TicketAdminActions({
  id,
  status,
  adminReply,
}: {
  id: string;
  status: string;
  adminReply: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  function run(action: () => Promise<unknown>, okMsg: string) {
    setBanner(null);
    start(async () => {
      try {
        await action();
        setBanner({ ok: true, text: okMsg });
        toast.success(okMsg);
        router.refresh();
      } catch (e) {
        const text = e instanceof Error ? e.message : "Action failed";
        setBanner({ ok: false, text });
        toast.error(text);
      }
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-white p-4">
      {banner ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            banner.ok ? "bg-sage/15 text-sage" : "bg-red-50 text-red-800"
          }`}
          role="status"
        >
          {banner.text}
        </p>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">Status</p>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              disabled={pending || status === s}
              onClick={() =>
                run(
                  () => updateTicketStatus(id, s),
                  `Status updated to ${s.replaceAll("_", " ")}`
                )
              }
            >
              {s.replaceAll("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(
            () => replyToTicket(id, String(fd.get("reply") || "")),
            "Reply saved. Customer will be notified by email and can see it under Account."
          );
        }}
      >
        <label className="text-sm font-medium" htmlFor="reply">
          Admin reply
        </label>
        <textarea
          id="reply"
          name="reply"
          defaultValue={adminReply || ""}
          rows={4}
          className="w-full rounded border border-border bg-cream px-3 py-2 text-sm"
          required
        />
        <AdminFormActions>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save reply"}
          </Button>
        </AdminFormActions>
      </form>
    </div>
  );
}
