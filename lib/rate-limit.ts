/**
 * Sliding-window rate limiter (in-memory per instance).
 * Adequate for demo/single-region; wire Upstash later via env if needed.
 */

type Bucket = { timestamps: number[] };

const memory = new Map<string, Bucket>();

export async function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number } = { limit: 30, windowMs: 60_000 }
) {
  const now = Date.now();
  const bucket = memory.get(key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < opts.windowMs);
  if (bucket.timestamps.length >= opts.limit) {
    memory.set(key, bucket);
    return { success: false as const, remaining: 0 };
  }
  bucket.timestamps.push(now);
  memory.set(key, bucket);
  return { success: true as const, remaining: opts.limit - bucket.timestamps.length };
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
