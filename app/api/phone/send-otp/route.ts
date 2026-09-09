import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth/require-user";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendPhoneOtp } from "@/lib/phone/otp";
import { toLocal10 } from "@/lib/phone";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUserApi();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json(
      { ok: false, error: "Your Google account email is required" },
      { status: 400 }
    );
  }

  const ip = clientIp(req);
  const rlUser = await rateLimit(`phone-otp:send:user:${user.id}`, {
    limit: 8,
    windowMs: 15 * 60_000,
  });
  const rlIp = await rateLimit(`phone-otp:send:ip:${ip}`, {
    limit: 20,
    windowMs: 15 * 60_000,
  });
  if (!rlUser.success || !rlIp.success) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const phone = toLocal10(String(body.phone || ""));
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid 10-digit Indian mobile number" },
      { status: 400 }
    );
  }

  const rlPhone = await rateLimit(`phone-otp:send:phone:${phone}`, {
    limit: 8,
    windowMs: 15 * 60_000,
  });
  if (!rlPhone.success) {
    return NextResponse.json(
      { ok: false, error: "Too many requests for this number. Please try again later." },
      { status: 429 }
    );
  }

  const result = await sendPhoneOtp({
    userId: user.id,
    email: user.email,
    phone,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
