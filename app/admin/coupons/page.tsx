import { requireScreenView } from "@/lib/auth/require-screen";
import type { Coupon } from "@prisma/client";
import { formatINR } from "@/lib/utils";
import { listCoupons } from "@/lib/coupons";
import { createCoupon } from "@/lib/actions/admin-marketing";
import { AdminForm, AdminFormActions } from "@/components/admin/admin-form";
import { FieldLabel, RequiredHint } from "@/components/admin/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function AdminCouponsPage() {
  await requireScreenView("coupons");
  const coupons: Coupon[] = await listCoupons();

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl">Coupons</h1>

      <AdminForm
        action={createCoupon}
        successMessage="Coupon created successfully"
        errorMessage="Could not create coupon"
        resetOnSuccess
        className="max-w-xl space-y-3 rounded-lg border border-border bg-white p-4"
      >
        <h2 className="font-display text-xl">Create coupon</h2>
        <RequiredHint />
        <div>
          <FieldLabel htmlFor="code" required>
            Code
          </FieldLabel>
          <Input id="code" name="code" required placeholder="SAVE10" className="mt-1.5" />
        </div>
        <div>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Input id="description" name="description" placeholder="10% off" className="mt-1.5" />
        </div>
        <p className="text-xs text-muted">Provide percent off and/or amount off (at least one).</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="percentOff">Percent off</FieldLabel>
            <Input
              id="percentOff"
              name="percentOff"
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="mt-1.5"
            />
          </div>
          <div>
            <FieldLabel htmlFor="amountOff">Amount off (₹)</FieldLabel>
            <Input id="amountOff" name="amountOff" type="number" step="1" min="0" className="mt-1.5" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="minOrder">Min order</FieldLabel>
            <Input
              id="minOrder"
              name="minOrder"
              type="number"
              min="0"
              defaultValue={0}
              className="mt-1.5"
            />
          </div>
          <div>
            <FieldLabel htmlFor="maxUses">Max uses</FieldLabel>
            <Input id="maxUses" name="maxUses" type="number" min="1" className="mt-1.5" />
          </div>
        </div>
        <AdminFormActions>
          <Button type="submit">Create</Button>
        </AdminFormActions>
      </AdminForm>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-off-white">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Discount</th>
              <th className="p-3">Uses</th>
              <th className="p-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-border">
                <td className="p-3 font-medium">{c.code}</td>
                <td className="p-3">
                  {c.percentOff != null ? `${c.percentOff}%` : null}
                  {c.amountOff != null ? formatINR(c.amountOff) : null}
                  {c.minOrder > 0 ? ` · min ${formatINR(c.minOrder)}` : ""}
                </td>
                <td className="p-3">
                  {c.usedCount}
                  {c.maxUses != null ? ` / ${c.maxUses}` : ""}
                </td>
                <td className="p-3">{c.active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {!coupons.length && (
              <tr>
                <td colSpan={4} className="p-3 text-muted">
                  No coupons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
