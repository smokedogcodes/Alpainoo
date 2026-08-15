import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-display text-4xl">Thank you</h1>
      <p className="mt-3 text-muted">
        Your order {searchParams.order ? <strong>{searchParams.order}</strong> : ""} has been placed.
        You will receive shipping updates once the courier picks it up.
      </p>
      <Button asChild className="mt-8">
        <Link href="/products">Continue shopping</Link>
      </Button>
    </div>
  );
}
