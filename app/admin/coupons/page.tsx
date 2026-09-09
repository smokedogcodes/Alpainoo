import { requireScreenView } from "@/lib/auth/require-screen";
import type { Coupon } from "@prisma/client";
import { formatCouponDiscountCell, listCoupons, resolveCouponKind } from "@/lib/coupons";
import { CouponCreateForm } from "@/components/admin/coupon-create-form";

const KIND_LABEL: Record<string, string> = {
  PERCENT: "Percentage",
  FIXED: "Fixed amount",
  PERCENT_CAPPED: "Percent + max",
  FREE_SHIPPING: "Free shipping",
};

export default async function AdminCouponsPage() {
  await requireScreenView("coupons");
  const coupons: Coupon[] = await listCoupons();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Coupons</h1>
        <p className="mt-1 text-sm text-muted">
          Create percentage, fixed, capped percentage, or free-shipping coupons. For percent + max,
          the “upto” amount is a hard cap (not an extra discount).
        </p>
      </div>

      <CouponCreateForm />

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-off-white">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Type</th>
              <th className="p-3">Discount</th>
              <th className="p-3">Uses</th>
              <th className="p-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => {
              const kind = resolveCouponKind(c);
              return (
                <tr key={c.id} className="border-b border-border">
                  <td className="p-3 font-medium">{c.code}</td>
                  <td className="p-3">{KIND_LABEL[kind] || kind}</td>
                  <td className="p-3">{formatCouponDiscountCell(c)}</td>
                  <td className="p-3">
                    {c.usedCount}
                    {c.maxUses != null ? ` / ${c.maxUses}` : ""}
                  </td>
                  <td className="p-3">{c.active ? "Yes" : "No"}</td>
                </tr>
              );
            })}
            {!coupons.length && (
              <tr>
                <td colSpan={5} className="p-3 text-muted">
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
