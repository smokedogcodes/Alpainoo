import { getSiteSettings } from "@/lib/gst/invoice";
import { saveSiteSettingsAction } from "@/lib/actions/site-settings";
import { requireAdmin } from "@/lib/auth/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default async function AdminSeoPage() {
  await requireAdmin();
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">SEO &amp; site settings</h1>
        <p className="mt-1 text-sm text-muted">
          Business details for invoices, analytics IDs, and default low-stock threshold.
        </p>
      </div>

      <form
        action={saveSiteSettingsAction}
        className="max-w-xl space-y-4 rounded-lg border border-border bg-white p-4"
      >
        <div>
          <Label htmlFor="businessName">Business name</Label>
          <Input
            id="businessName"
            name="businessName"
            defaultValue={settings.businessName || ""}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="gstin">GSTIN</Label>
          <Input id="gstin" name="gstin" defaultValue={settings.gstin || ""} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="businessAddress">Business address</Label>
          <Textarea
            id="businessAddress"
            name="businessAddress"
            defaultValue={settings.businessAddress || ""}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="gaMeasurementId">GA measurement ID</Label>
          <Input
            id="gaMeasurementId"
            name="gaMeasurementId"
            placeholder="G-XXXXXXXX"
            defaultValue={settings.gaMeasurementId || ""}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="metaPixelId">Meta Pixel ID</Label>
          <Input
            id="metaPixelId"
            name="metaPixelId"
            defaultValue={settings.metaPixelId || ""}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="lowStockDefault">Default low-stock threshold</Label>
          <Input
            id="lowStockDefault"
            name="lowStockDefault"
            type="number"
            min={0}
            defaultValue={settings.lowStockDefault}
            className="mt-1.5"
          />
        </div>
        <Button type="submit">Save settings</Button>
      </form>
    </div>
  );
}
