/**
 * Lightweight HTML sanitizer for blog content.
 * Avoids isomorphic-dompurify/jsdom (breaks Vercel serverless with ERR_REQUIRE_ESM).
 */
export function sanitizeBlogHtml(input: string) {
  let html = String(input || "");
  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<\/?(iframe|object|embed|form|link|meta|base)(\s[^>]*)?>/gi, "");
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/javascript\s*:/gi, "");
  html = html.replace(/data\s*:\s*text\/html/gi, "");
  return html;
}
