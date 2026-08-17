import { notFound, redirect } from "next/navigation";
import { ReceiptPrinterExperience } from "@/components/checkout/receipt-printer-experience";
import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";
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

  const user = await requireUser({ callbackPath: opaqueHref("/checkout/success") });
  const access = verifyOrderAccess(searchParams.t);
  if (!access || access.userId !== user.id) {
    notFound();
  }

  const owned = await prisma.order.findFirst({
    where: {
      id: access.orderId,
      orderNumber: access.orderNumber,
      OR: [{ userId: user.id }, ...(user.email ? [{ email: user.email }] : [])],
    },
    include: {
      items: {
        include: { product: { select: { title: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!owned) {
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
