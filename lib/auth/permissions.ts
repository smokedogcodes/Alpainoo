export const ADMIN_SCREENS = [
  "overview",
  "products",
  "categories",
  "collections",
  "coupons",
  "orders",
  "returns",
  "reviews",
  "users",
  "roles",
  "marketing",
  "seo",
  "tickets",
  "knowledge",
  "blog",
  "reports",
  "logs",
] as const;

export type AdminScreen = (typeof ADMIN_SCREENS)[number];
export type PermissionAction = "view" | "edit" | "delete";
export type ScreenPermission = {
  view: boolean;
  edit: boolean;
  delete: boolean;
};
export type PermissionMatrix = Record<AdminScreen, ScreenPermission>;
export type AssignableRole = "ADMIN" | "STAFF" | "TEMP" | "CUSTOMER";

export const SCREEN_LABELS: Record<AdminScreen, string> = {
  overview: "Overview",
  products: "Products",
  categories: "Categories",
  collections: "Collections",
  coupons: "Coupons",
  orders: "Orders",
  returns: "Returns",
  reviews: "Reviews",
  users: "Users",
  roles: "Role defaults",
  marketing: "Marketing",
  seo: "SEO",
  tickets: "Tickets",
  knowledge: "Knowledge",
  blog: "Blog",
  reports: "Reports",
  logs: "Audit logs",
};

/** Map admin nav href → permission screen */
export const HREF_TO_SCREEN: Record<string, AdminScreen> = {
  "/admin": "overview",
  "/admin/products": "products",
  "/admin/categories": "categories",
  "/admin/collections": "collections",
  "/admin/coupons": "coupons",
  "/admin/orders": "orders",
  "/admin/returns": "returns",
  "/admin/reviews": "reviews",
  "/admin/users": "users",
  "/admin/roles": "roles",
  "/admin/marketing": "marketing",
  "/admin/seo": "seo",
  "/admin/tickets": "tickets",
  "/admin/knowledge": "knowledge",
  "/admin/blog": "blog",
  "/admin/reports": "reports",
  "/admin/logs": "logs",
};

export function emptyMatrix(): PermissionMatrix {
  return Object.fromEntries(
    ADMIN_SCREENS.map((s) => [s, { view: false, edit: false, delete: false }])
  ) as PermissionMatrix;
}

export function fullMatrix(): PermissionMatrix {
  return Object.fromEntries(
    ADMIN_SCREENS.map((s) => [s, { view: true, edit: true, delete: true }])
  ) as PermissionMatrix;
}

function screenPerm(
  view = false,
  edit = false,
  del = false
): ScreenPermission {
  return {
    view: view || edit || del,
    edit: Boolean(edit),
    delete: Boolean(del),
  };
}

/** Built-in Staff defaults (used when DB template missing). */
export function defaultStaffTemplate(): PermissionMatrix {
  const m = emptyMatrix();
  m.overview = screenPerm(true);
  m.products = screenPerm(true, true, false);
  m.orders = screenPerm(true, true, false);
  m.returns = screenPerm(true, true, false);
  m.tickets = screenPerm(true, true, false);
  return m;
}

/** Built-in Temp defaults (used when DB template missing). */
export function defaultTempTemplate(): PermissionMatrix {
  const m = emptyMatrix();
  m.overview = screenPerm(true);
  m.products = screenPerm(true, false, false);
  return m;
}

export type RoleTemplates = {
  STAFF: PermissionMatrix;
  TEMP: PermissionMatrix;
};

export function defaultRoleTemplates(): RoleTemplates {
  return {
    STAFF: defaultStaffTemplate(),
    TEMP: defaultTempTemplate(),
  };
}

function coerceScreen(raw: unknown): ScreenPermission {
  if (!raw || typeof raw !== "object") return screenPerm(false);
  const o = raw as Record<string, unknown>;
  const edit = Boolean(o.edit);
  const del = Boolean(o.delete);
  const view = Boolean(o.view) || edit || del;
  return { view, edit, delete: del };
}

/** Parse stored JSON; accepts object matrix or legacy array (treated as empty override). */
export function parsePermissionMatrix(raw: string | null | undefined): PermissionMatrix | null {
  if (raw == null || raw.trim() === "" || raw.trim() === "[]") return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return null;
    if (!parsed || typeof parsed !== "object") return null;
    const keys = Object.keys(parsed).filter((k) =>
      (ADMIN_SCREENS as readonly string[]).includes(k)
    );
    if (keys.length === 0) return null;
    const base = emptyMatrix();
    for (const screen of ADMIN_SCREENS) {
      if (screen in parsed) {
        base[screen] = coerceScreen((parsed as Record<string, unknown>)[screen]);
      }
    }
    return base;
  } catch {
    return null;
  }
}

export function serializePermissionMatrix(matrix: PermissionMatrix): string {
  return JSON.stringify(matrix);
}

/**
 * Per-user override: null/[] → role template; otherwise override is the full matrix.
 */
export function resolvePermissionMatrix(input: {
  role: string;
  permissionsJson?: string | null;
  roleExpiresAt?: Date | string | null;
  templates?: RoleTemplates;
  now?: Date;
}): { effectiveRole: AssignableRole; matrix: PermissionMatrix; expired: boolean } {
  const now = input.now ?? new Date();
  const templates = input.templates ?? defaultRoleTemplates();
  let role = (input.role || "CUSTOMER").toUpperCase() as AssignableRole;
  let expired = false;

  if (role === "TEMP") {
    const exp = input.roleExpiresAt
      ? input.roleExpiresAt instanceof Date
        ? input.roleExpiresAt
        : new Date(input.roleExpiresAt)
      : null;
    if (!exp || Number.isNaN(exp.getTime()) || exp.getTime() <= now.getTime()) {
      expired = true;
      role = "CUSTOMER";
    }
  }

  if (role === "ADMIN") {
    return { effectiveRole: "ADMIN", matrix: fullMatrix(), expired: false };
  }

  if (role !== "STAFF" && role !== "TEMP") {
    return { effectiveRole: "CUSTOMER", matrix: emptyMatrix(), expired };
  }

  const template = role === "STAFF" ? templates.STAFF : templates.TEMP;
  const override = parsePermissionMatrix(input.permissionsJson);
  const matrix = JSON.parse(JSON.stringify(override ?? template)) as PermissionMatrix;

  // Staff/Temp never manage users or role templates
  matrix.users = screenPerm(false);
  matrix.roles = screenPerm(false);

  return { effectiveRole: role, matrix, expired };
}

export function can(
  matrix: PermissionMatrix,
  screen: AdminScreen,
  action: PermissionAction
): boolean {
  const p = matrix[screen];
  if (!p) return false;
  if (action === "view") return p.view || p.edit || p.delete;
  if (action === "edit") return p.edit;
  return p.delete;
}

export function hasAnyAdminView(matrix: PermissionMatrix): boolean {
  return ADMIN_SCREENS.some((s) => can(matrix, s, "view"));
}

export function isStaffLikeRole(role: string | null | undefined): boolean {
  const r = (role || "").toUpperCase();
  return r === "ADMIN" || r === "STAFF" || r === "TEMP";
}

export function parseRoleTemplates(raw: string | null | undefined): RoleTemplates {
  const defaults = defaultRoleTemplates();
  if (!raw?.trim()) return defaults;
  try {
    const parsed = JSON.parse(raw) as { STAFF?: unknown; TEMP?: unknown };
    return {
      STAFF: parsePermissionMatrix(JSON.stringify(parsed.STAFF ?? null)) ?? defaults.STAFF,
      TEMP: parsePermissionMatrix(JSON.stringify(parsed.TEMP ?? null)) ?? defaults.TEMP,
    };
  } catch {
    return defaults;
  }
}

export function serializeRoleTemplates(templates: RoleTemplates): string {
  return JSON.stringify(templates);
}

/** Path → screen for page guards */
export function screenFromAdminPath(pathname: string): AdminScreen | null {
  if (pathname === "/admin" || pathname === "/admin/") return "overview";
  const hit = Object.entries(HREF_TO_SCREEN).find(
    ([href]) => href !== "/admin" && (pathname === href || pathname.startsWith(`${href}/`))
  );
  return hit ? hit[1] : null;
}
