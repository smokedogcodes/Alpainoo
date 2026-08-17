import { createHmac, timingSafeEqual } from "crypto";

type OrderAccessPayload = {
  orderId: string;
  orderNumber: string;
  userId: string;
  celebrate: boolean;
  exp: number;
};

function secret() {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) throw new Error("AUTH_SECRET is not configured");
  return s;
}

function signBody(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Signed, opaque access token for checkout success / order deep links. */
export function signOrderAccess(input: {
  orderId: string;
  orderNumber: string;
  userId: string;
  celebrate?: boolean;
  ttlMs?: number;
}) {
  const payload: OrderAccessPayload = {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    userId: input.userId,
    celebrate: Boolean(input.celebrate),
    exp: Date.now() + (input.ttlMs ?? 7 * 24 * 60 * 60 * 1000),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function verifyOrderAccess(token: string | undefined | null): OrderAccessPayload | null {
  if (!token || typeof token !== "string") return null;
  const trimmed = token.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  if (!body || !sig || !safeEqual(sig, signBody(body))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OrderAccessPayload;
    if (!parsed?.orderId || !parsed?.userId || !parsed?.orderNumber || !parsed?.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return {
      orderId: String(parsed.orderId),
      orderNumber: String(parsed.orderNumber),
      userId: String(parsed.userId),
      celebrate: Boolean(parsed.celebrate),
      exp: Number(parsed.exp),
    };
  } catch {
    return null;
  }
}

export function celebrateCookieName(orderId: string) {
  return `ek_rcpt_${orderId.slice(0, 24)}`;
}
