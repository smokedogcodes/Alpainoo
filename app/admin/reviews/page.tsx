import { requireScreenView } from "@/lib/auth/require-screen";
import { listPendingReviews } from "@/lib/actions/reviews";
import { ApproveReviewButton } from "@/components/admin/approve-review-button";

export default async function AdminReviewsPage() {
  await requireScreenView("reviews");
  const reviews = await listPendingReviews(100);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Reviews</h1>
      <p className="text-sm text-muted">Approve customer reviews before they appear on product pages.</p>
      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">
                  {r.author} · {r.rating}/5
                </p>
                {r.title && <p className="mt-1 text-sm text-sage">{r.title}</p>}
                <p className="mt-2 text-sm">{r.body}</p>
                <p className="mt-2 text-xs text-muted">
                  Product {r.productId} · {r.createdAt.toLocaleString("en-IN")}
                </p>
              </div>
              <ApproveReviewButton id={r.id} />
            </div>
          </div>
        ))}
        {!reviews.length && <p className="text-muted">No pending reviews.</p>}
      </div>
    </div>
  );
}
