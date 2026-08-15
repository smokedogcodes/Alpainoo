import { NextResponse } from "next/server";
import { checkPincodeServiceability } from "@/lib/shiprocket";
import { PincodeSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limited = await rateLimit(`pincode:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PincodeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pincode" }, { status: 400 });
  }

  const result = await checkPincodeServiceability(parsed.data.pincode);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
    },
  });
}
