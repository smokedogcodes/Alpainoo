import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findOrderById } from "@/lib/db/orders";

/**
 * Customer order lookup — BOLA/IDOR safe:
 * only returns the order if it belongs to the signed-in user (by userId or email).
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id && !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await findOrderById(params.id);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ownsById = session.user.id && order.userId === session.user.id;
  const ownsByEmail =
    session.user.email &&
    order.email.toLowerCase() === session.user.email.toLowerCase();
  if (!ownsById && !ownsByEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        email: order.email,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items.map((i) => ({
          id: i.id,
          quantity: i.quantity,
          price: i.price,
          product: {
            title: i.product.title,
            slug: i.product.slug,
            sku: i.product.sku,
          },
        })),
        shipment: order.shipment,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
