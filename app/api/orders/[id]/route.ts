import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  const order = await prisma.order.findFirst({
    where: {
      id: params.id,
      OR: [
        ...(session.user.id ? [{ userId: session.user.id }] : []),
        ...(session.user.email ? [{ email: session.user.email }] : []),
      ],
    },
    include: {
      items: { include: { product: { select: { title: true, slug: true, sku: true } } } },
      shipment: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ order }, { headers: { "Cache-Control": "no-store" } });
}
