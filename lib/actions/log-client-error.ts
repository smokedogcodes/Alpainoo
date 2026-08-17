"use server";

import { logError } from "@/lib/logging/system-log";

export async function logClientError(input: {
  message: string;
  digest?: string;
  path?: string;
}) {
  await logError({
    category: "ui",
    action: "UNHANDLED_EXCEPTION",
    message: (input.message || "Client error").slice(0, 2000),
    path: input.path?.slice(0, 500) || null,
    meta: { digest: input.digest || null },
  });
}
