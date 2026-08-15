import { NextResponse } from "next/server";
import { checkPincodeServiceability } from "@/lib/shiprocket";

export async function POST(req: Request) {
  const { pincode } = await req.json();
  const result = await checkPincodeServiceability(String(pincode || ""));
  return NextResponse.json(result);
}
