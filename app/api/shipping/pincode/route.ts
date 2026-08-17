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
  const allowOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const headers: Record<string, string> = {
    "Cache-Control": "private, max-age=300",
  };
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    headers.Vary = "Origin";
  }
  return NextResponse.json(result, { headers });
}
