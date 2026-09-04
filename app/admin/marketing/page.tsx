import { asD1, getD1 } from "@/lib/db/d1";
import { sendNewsletterCampaign } from "@/lib/actions/admin-marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

async function getSubscriberCount() {
  const db = await getD1();
  if (db) {
    try {
      const row = await asD1(db)
        .prepare(`SELECT COUNT(*) as c FROM NewsletterSubscriber WHERE active = 1`)
        .first();
      return Number(row?.c ?? 0);
    } catch {
      return 0;
    }
  }
  try {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    return prisma.newsletterSubscriber.count({ where: { active: true } });
  } catch {
    return 0;
  }
}

export default async function AdminMarketingPage() {
  const count = await getSubscriberCount();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Marketing</h1>
        <p className="mt-2 text-sm text-muted">
          Active newsletter subscribers: <strong>{count}</strong>
        </p>
      </div>

      <form
        action={sendNewsletterCampaign}
        className="max-w-2xl space-y-3 rounded-lg border border-border bg-white p-4"
      >
        <h2 className="font-display text-xl">Send campaign</h2>
        <p className="text-xs text-muted">
          Sends via Resend to all active subscribers. Failures are skipped (fail-soft).
        </p>
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" name="subject" required placeholder="Spring skincare picks" />
        </div>
        <div>
          <Label htmlFor="bodyHtml">HTML body</Label>
          <Textarea
            id="bodyHtml"
            name="bodyHtml"
            required
            rows={8}
            placeholder="<p>Hello from Alpainoo…</p>"
          />
        </div>
        <Button type="submit" disabled={count === 0}>
          Send to {count} subscriber{count === 1 ? "" : "s"}
        </Button>
      </form>
    </div>
  );
}
