import { getAnalytics } from "@/lib/reports";
import { formatINR } from "@/lib/utils";
import { RevenueChart, StatusChart } from "@/components/admin/charts";

export default async function AdminOverviewPage() {
  const data = await getAnalytics();

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl md:text-4xl">Analytics</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Today's Sales", value: formatINR(data.todaySales) },
          { label: "Today's Orders", value: String(data.todayOrderCount) },
          { label: "Total Paid Orders", value: String(data.totalOrders) },
          { label: "Average Order Value", value: formatINR(data.aov) },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-border bg-white p-4">
            <p className="text-xs text-muted">{m.label}</p>
            <p className="mt-1 font-display text-2xl">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-4">
          <h2 className="font-display text-xl mb-4">Revenue (14 days)</h2>
          <RevenueChart data={data.revenueTrend} />
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <h2 className="font-display text-xl mb-4">Orders by status</h2>
          <StatusChart data={data.statusCounts} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-4">
          <h2 className="font-display text-xl">Low stock alerts</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.lowStock.map((p) => (
              <li key={p.id} className="flex justify-between py-2 text-sm">
                <span>{p.title}</span>
                <span className="font-medium text-price-sale">{p.stock} left</span>
              </li>
            ))}
            {!data.lowStock.length && <li className="py-2 text-sm text-muted">All stocked up.</li>}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <h2 className="font-display text-xl">Top products</h2>
          <ul className="mt-3 divide-y divide-border">
            {data.topProducts.map((p) => (
              <li key={p.title} className="flex justify-between py-2 text-sm">
                <span>{p.title}</span>
                <span>{p.units} units</span>
              </li>
            ))}
            {!data.topProducts.length && (
              <li className="py-2 text-sm text-muted">No sales yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
