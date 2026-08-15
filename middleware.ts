import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminDevBypass } from "@/lib/auth/admin";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  const isAdminApi = path === "/api/admin" || path.startsWith("/api/admin/");

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  if (isAdminDevBypass()) {
    return NextResponse.next();
  }

  const role = req.auth?.user?.role;
  const hasAuth = Boolean(req.auth?.user);
  const authCookieNames = req.cookies
    .getAll()
    .map((c) => c.name)
    .filter((n) => /auth|session|csrf/i.test(n));

  // #region agent log
  const dbg = [
    hasAuth ? "auth1" : "auth0",
    role ? `role_${role}` : "role0",
    `ck${authCookieNames.length}`,
  ].join("-");
  fetch("http://127.0.0.1:7376/ingest/6e190034-3568-4fc1-85eb-6c282aded999", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "b3f0a8",
    },
    body: JSON.stringify({
      sessionId: "b3f0a8",
      timestamp: Date.now(),
      runId: "pre-fix",
      hypothesisId: "A,B,C",
      location: "middleware.ts:admin-gate",
      message: "Admin middleware gate",
      data: {
        path,
        hasAuth,
        role: role || null,
        authCookieNames,
        hasUserId: Boolean(req.auth?.user?.id),
      },
    }),
  }).catch(() => {});
  // #endregion

  if (!req.auth?.user || role !== "ADMIN") {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    url.searchParams.set("error", req.auth ? "unauthorized" : "login");
    // #region agent log
    url.searchParams.set("dbg", dbg);
    // #endregion
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin", "/api/admin/:path*"],
};
