"use server";

import { headers } from "next/headers";
import { logError } from "@/lib/logging/system-log";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/security/sanitize-text";

export async function logClientError(input: {
  message: string;
  digest?: string;
  path?: string;
}) {
  const h = headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const limited = await rateLimit(`client-error:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!limited.success) return;

  await logError({
    category: "ui",
    action: "UNHANDLED_EXCEPTION",
    message: sanitizePlainText(input.message || "Client error", 500),
    path: sanitizePlainText(input.path || "", 200) || null,
    meta: { digest: sanitizePlainText(input.digest || "", 120) || null },
  });
}
