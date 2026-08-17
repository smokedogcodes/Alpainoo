"use client";

import { useTransition } from "react";
import { updateTicketStatus, replyToTicket } from "@/lib/actions/tickets";
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
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4 rounded-lg border border-border bg-white p-4">
      <div>
        <p className="mb-2 text-sm font-medium">Status</p>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              disabled={pending}
              onClick={() => start(() => updateTicketStatus(id, s))}
            >
              {s.replaceAll("_", " ")}
            </Button>
          ))}
        </div>
      </div>
      <form
        className="space-y-2"
        action={(fd) => {
          start(async () => {
            await replyToTicket(id, String(fd.get("reply") || ""));
          });
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
        <Button type="submit" disabled={pending}>
          Save reply
        </Button>
      </form>
    </div>
  );
}
