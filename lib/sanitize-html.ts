import DOMPurify from "isomorphic-dompurify";

/** Blog HTML sanitization only — keep out of checkout/validation shared imports (jsdom breaks Vercel CJS). */
export function sanitizeBlogHtml(input: string) {
  return DOMPurify.sanitize(input, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "style"],
  });
}
