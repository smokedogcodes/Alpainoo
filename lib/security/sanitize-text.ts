/**
 * Strip null bytes / control characters and clamp length before DB writes.
 * Use with Zod transforms — Prisma already parameterizes queries (no SQL concat).
 */

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizePlainText(input: string, maxLen = 2000): string {
  return input.replace(CONTROL, "").normalize("NFKC").trim().slice(0, maxLen);
}

export function sanitizeMultiline(input: string, maxLen = 5000): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .normalize("NFKC")
    .trim()
    .slice(0, maxLen);
}

/** Wrap untrusted user text so it cannot be read as model instructions. */
export function wrapUntrustedForPrompt(label: string, text: string, maxLen = 2000): string {
  const safe = sanitizeMultiline(text, maxLen)
    .replace(/<\/?untrusted[^>]*>/gi, "")
    .replace(/\b(system|developer)\s*:/gi, "[filtered]:");
  return `<untrusted source="${label}">\n${safe}\n</untrusted>`;
}
