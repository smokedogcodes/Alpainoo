import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { opaqueHref } from "@/lib/security/opaque-routes";
import { findOrderById } from "@/lib/db/orders";
import { buildInvoiceHtml } from "@/lib/gst/invoice";
import { PrintInvoiceButton } from "@/components/orders/print-invoice-button";

export default async function OrderInvoicePage({ params }: { params: { id: string } }) {
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(params.id)) {
    notFound();
  }

  const user = await requireUser({
    callbackPath: opaqueHref(`/orders/${params.id}/invoice`),
  });

  const order = await findOrderById(params.id);
  if (
    !order ||
    (order.userId !== user.id && !(user.email && order.email === user.email))
  ) {
    notFound();
  }

  const html = await buildInvoiceHtml(order);

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto flex max-w-store items-center justify-between gap-4 px-4 py-4 print:hidden md:px-6">
        <Link href={opaqueHref(`/orders/${order.id}`)} className="text-sm text-sage underline">
          ← Back to order
        </Link>
        <PrintInvoiceButton />
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
