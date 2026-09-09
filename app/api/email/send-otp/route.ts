import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendEmailOtp } from "@/lib/email/otp";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rlIp = await rateLimit(`email-otp:send:ip:${ip}`, {
    limit: 20,
    windowMs: 15 * 60_000,
  });
  if (!rlIp.success) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address" }, { status: 400 });
  }

  const rlEmail = await rateLimit(`email-otp:send:email:${email}`, {
    limit: 8,
    windowMs: 15 * 60_000,
  });
  if (!rlEmail.success) {
    return NextResponse.json(
      { ok: false, error: "Too many requests for this email. Please try again later." },
      { status: 429 }
    );
  }

  const result = await sendEmailOtp({ email });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
