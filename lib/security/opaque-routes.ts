/**
 * Stable opaque public paths so the browser URL does not reveal route names
 * like /sale. Middleware rewrites /c/<code> → internal path and redirects
 * direct hits on descriptive paths to the opaque form.
 */

type Alias = {
  code: string;
  /** Internal Next.js pathname prefix */
  internal: string;
  /** If true, only exact /internal matches (not /internal/...) */
  exact?: boolean;
};

const ALIASES: Alias[] = [
  { code: "s7k2m9", internal: "/sale", exact: true },
  { code: "p4xq1n", internal: "/products" },
  { code: "b8w3rt", internal: "/blog" },
  { code: "a2h6vj", internal: "/about", exact: true },
  { code: "k9c4wx", internal: "/checkout" },
  { code: "o3m7kp", internal: "/orders" },
];

const BY_CODE = new Map(ALIASES.map((a) => [a.code, a]));

/** Paths that must never be shown descriptively in the address bar. */
export const DESCRIPTIVE_PUBLIC_PREFIXES = ALIASES.map((a) => a.internal);

export function resolveOpaquePath(pathname: string): string | null {
  if (!pathname.startsWith("/c/")) return null;
  const rest = pathname.slice(3);
  const slash = rest.indexOf("/");
  const code = slash === -1 ? rest : rest.slice(0, slash);
  const suffix = slash === -1 ? "" : rest.slice(slash);
  const alias = BY_CODE.get(code);
  if (!alias) return null;
  if (alias.exact && suffix) return null;
  return `${alias.internal}${suffix}`;
}

/** Map an internal href to the opaque public href (preserves query/hash). */
export function opaqueHref(href: string): string {
  if (!href.startsWith("/")) return href;
  if (href.startsWith("/c/")) return href;
  if (href === "/" || href.startsWith("/api") || href.startsWith("/admin") || href.startsWith("/auth")) {
    return href;
  }

  const qIndex = href.indexOf("?");
  const hIndex = href.indexOf("#");
  let pathEnd = href.length;
  if (qIndex >= 0) pathEnd = Math.min(pathEnd, qIndex);
  if (hIndex >= 0) pathEnd = Math.min(pathEnd, hIndex);
  const path = href.slice(0, pathEnd) || "/";
  const tail = href.slice(pathEnd);

  for (const alias of ALIASES) {
    if (path === alias.internal || (!alias.exact && path.startsWith(`${alias.internal}/`))) {
      const suffix = path === alias.internal ? "" : path.slice(alias.internal.length);
      return `/c/${alias.code}${suffix}${tail}`;
    }
  }
  return href;
}

/** If this descriptive path should redirect to opaque form, return the opaque pathname. */
export function descriptiveToOpaquePath(pathname: string): string | null {
  for (const alias of ALIASES) {
    if (pathname === alias.internal || (!alias.exact && pathname.startsWith(`${alias.internal}/`))) {
      const suffix = pathname === alias.internal ? "" : pathname.slice(alias.internal.length);
      return `/c/${alias.code}${suffix}`;
    }
  }
  return null;
}
