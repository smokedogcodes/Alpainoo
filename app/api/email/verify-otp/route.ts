import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { EMAIL_OTP_LENGTH, verifyEmailOtp } from "@/lib/email/otp";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`email-otp:verify:ip:${ip}`, {
    limit: 30,
    windowMs: 15 * 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  let body: { email?: string; otp?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const otp = String(body.otp || "").replace(/\D/g, "");
  if (!email) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address" }, { status: 400 });
  }
  if (otp.length !== EMAIL_OTP_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Enter the ${EMAIL_OTP_LENGTH}-digit code from your email` },
      { status: 400 }
    );
  }

  const result = await verifyEmailOtp({
    email,
    otp,
    name: body.name || null,
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  // ticket used by client signIn("email-otp") — never log ticket/otp
  return NextResponse.json({
    ok: true,
    email: result.email,
    ticket: result.ticket,
  });
}
