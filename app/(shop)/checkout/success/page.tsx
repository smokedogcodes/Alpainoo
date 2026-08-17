import { auth } from "@/auth";
import { ReceiptPrinterExperience } from "@/components/checkout/receipt-printer-experience";
import { prisma } from "@/lib/prisma";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { order?: string };
}) {
  const orderNumber = searchParams.order?.trim() || "your order";
  const session = await auth();

  let receipt = {
    orderNumber,
  } as {
    orderId?: string;
    orderNumber: string;
    createdAt?: string;
    totalAmount?: number;
    paymentStatus?: string;
    items?: { title: string; quantity: number; price: number }[];
  };

  if (searchParams.order && (session?.user?.id || session?.user?.email)) {
    const owned = await prisma.order.findFirst({
      where: {
        orderNumber: searchParams.order,
        OR: [
          ...(session.user.id ? [{ userId: session.user.id }] : []),
          ...(session.user.email ? [{ email: session.user.email }] : []),
        ],
      },
      include: {
        items: {
          include: { product: { select: { title: true } } },
          orderBy: { id: "asc" },
        },
      },
    });

    if (owned) {
      receipt = {
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
      };
    }
  }

  return <ReceiptPrinterExperience order={receipt} />;
}
