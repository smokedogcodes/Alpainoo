import { notFound, redirect } from "next/navigation";
import { ReceiptPrinterExperience } from "@/components/checkout/receipt-printer-experience";
import { auth } from "@/auth";
import { findOrderById } from "@/lib/db/orders";
import { verifyOrderAccess } from "@/lib/security/order-access";
import { opaqueHref } from "@/lib/security/opaque-routes";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { t?: string; order?: string };
}) {
  // Legacy ?order= URLs are no longer accepted (IDOR / enumeration).
  if (searchParams.order && !searchParams.t) {
    redirect(opaqueHref("/orders"));
  }

  const access = verifyOrderAccess(searchParams.t);
  if (!access) {
    notFound();
  }

  const session = await auth();
  // Signed-in users must match the token; guests rely on the signed token alone.
  if (session?.user?.id && access.userId !== session.user.id) {
    notFound();
  }

  const owned = await findOrderById(access.orderId);
  if (
    !owned ||
    owned.orderNumber !== access.orderNumber ||
    (owned.userId && owned.userId !== access.userId)
  ) {
    notFound();
  }

  return (
    <ReceiptPrinterExperience
      playCelebration={Boolean(access.celebrate)}
      order={{
        orderId: owned.id,
        orderNumber: owned.orderNumber,
        createdAt: owned.createdAt.toISOString(),
        totalAmount: owned.totalAmount,
        paymentStatus: owned.paymentStatus,
        items: owned.items.map((item) => ({
          title: item.product.title,
          quantity: item.quantity,
          price: item.price,
        })),
      }}
    />
  );
}
