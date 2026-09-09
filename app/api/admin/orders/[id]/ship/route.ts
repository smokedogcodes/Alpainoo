import { NextResponse } from "next/server";
import { requirePermissionApi } from "@/lib/auth/admin";
import { shipOrderWithShiprocket } from "@/lib/fulfillment-shiprocket";

export async function POST(
  _req: Request,
  context: { params: { id: string } }
) {
  const admin = await requirePermissionApi("orders", "edit");
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orderId = context.params.id;
  if (!orderId) {
    return NextResponse.json({ error: "Order id required" }, { status: 400 });
  }

  try {
    const result = await shipOrderWithShiprocket(orderId, {
      requireCredentials: true,
    });
    return NextResponse.json({
      shipmentId: result.shipmentId,
      awbCode: result.awbCode,
      trackingUrl: result.trackingUrl,
      orderStatus: result.orderStatus,
      warning: result.warning ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ship failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
