import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth/require-user";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { OTP_LENGTH, verifyPhoneOtp } from "@/lib/phone/otp";
import { toLocal10 } from "@/lib/phone";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUserApi();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  }

  const ip = clientIp(req);
  const rl = await rateLimit(`phone-otp:verify:${user.id}:${ip}`, {
    limit: 30,
    windowMs: 15 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  let body: { phone?: string; otp?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const phone = toLocal10(String(body.phone || ""));
  const otp = String(body.otp || "").replace(/\D/g, "");
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid 10-digit Indian mobile number" },
      { status: 400 }
    );
  }
  if (otp.length !== OTP_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Enter the ${OTP_LENGTH}-digit code from your email` },
      { status: 400 }
    );
  }

  const result = await verifyPhoneOtp({ userId: user.id, phone, otp });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
