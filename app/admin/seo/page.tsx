import { getSiteSettings } from "@/lib/gst/invoice";
import { saveSiteSettingsAction } from "@/lib/actions/site-settings";
import { requireScreenView } from "@/lib/auth/require-screen";
import { AdminForm, AdminFormActions } from "@/components/admin/admin-form";
import { FieldLabel } from "@/components/admin/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default async function AdminSeoPage() {
  await requireScreenView("seo");
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">SEO &amp; site settings</h1>
        <p className="mt-1 text-sm text-muted">
          Business details for invoices, analytics IDs, and default low-stock threshold.
        </p>
      </div>

      <AdminForm
        action={saveSiteSettingsAction}
        successMessage="Settings saved successfully"
        errorMessage="Could not save settings"
        className="max-w-xl space-y-4 rounded-lg border border-border bg-white p-4"
      >
        <div>
          <FieldLabel htmlFor="businessName">Business name</FieldLabel>
          <Input
            id="businessName"
            name="businessName"
            defaultValue={settings.businessName || ""}
            className="mt-1.5"
          />
        </div>
        <div>
          <FieldLabel htmlFor="gstin">GSTIN</FieldLabel>
          <Input id="gstin" name="gstin" defaultValue={settings.gstin || ""} className="mt-1.5" />
        </div>
        <div>
          <FieldLabel htmlFor="businessAddress">Business address</FieldLabel>
          <Textarea
            id="businessAddress"
            name="businessAddress"
            defaultValue={settings.businessAddress || ""}
            className="mt-1.5"
          />
        </div>
        <div>
          <FieldLabel htmlFor="gaMeasurementId">GA measurement ID</FieldLabel>
          <Input
            id="gaMeasurementId"
            name="gaMeasurementId"
            placeholder="G-XXXXXXXX"
            defaultValue={settings.gaMeasurementId || ""}
            className="mt-1.5"
          />
        </div>
        <div>
          <FieldLabel htmlFor="metaPixelId">Meta Pixel ID</FieldLabel>
          <Input
            id="metaPixelId"
            name="metaPixelId"
            defaultValue={settings.metaPixelId || ""}
            className="mt-1.5"
          />
        </div>
        <div>
          <FieldLabel htmlFor="lowStockDefault">Default low-stock threshold</FieldLabel>
          <Input
            id="lowStockDefault"
            name="lowStockDefault"
            type="number"
            min={0}
            defaultValue={settings.lowStockDefault}
            className="mt-1.5"
          />
        </div>
        <AdminFormActions>
          <Button type="submit">Save settings</Button>
        </AdminFormActions>
      </AdminForm>
    </div>
  );
}
