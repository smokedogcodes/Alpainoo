import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminDevBypass } from "@/lib/auth/admin";
import { descriptiveToOpaquePath, resolveOpaquePath } from "@/lib/security/opaque-routes";

const AUTH_REQUIRED_PREFIXES = ["/orders", "/checkout"];

function needsLogin(pathname: string) {
  return AUTH_REQUIRED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export default auth((req) => {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // Opaque gateway: /c/<code>/... → internal route (URL stays opaque)
  const rewritten = resolveOpaquePath(path);
  if (rewritten) {
    url.pathname = rewritten;
    // After rewrite, continue auth checks on the internal path
    const internalPath = rewritten;
    if (needsLogin(internalPath) && !req.auth?.user?.id) {
      const login = req.nextUrl.clone();
      login.pathname = "/";
      login.search = "";
      login.searchParams.set("error", "login");
      login.searchParams.set("next", `${path}${req.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
    return NextResponse.rewrite(url);
  }

  // Hide descriptive public paths in the address bar
  const opaque = descriptiveToOpaquePath(path);
  if (opaque) {
    url.pathname = opaque;
    return NextResponse.redirect(url, 308);
  }

  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  const isAdminApi = path === "/api/admin" || path.startsWith("/api/admin/");

  if (needsLogin(path) && !req.auth?.user?.id) {
    const login = req.nextUrl.clone();
    login.pathname = "/";
    login.search = "";
    login.searchParams.set("error", "login");
    login.searchParams.set("next", `${path}${req.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  if (isAdminDevBypass()) {
    return NextResponse.next();
  }

  const role = req.auth?.user?.role;
  if (!req.auth?.user || role !== "ADMIN") {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const home = req.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    home.searchParams.set("error", req.auth ? "unauthorized" : "login");
    return NextResponse.redirect(home);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin",
    "/api/admin/:path*",
    "/orders",
    "/orders/:path*",
    "/checkout",
    "/checkout/:path*",
    "/sale",
    "/sale/:path*",
    "/products",
    "/products/:path*",
    "/blog",
    "/blog/:path*",
    "/about",
    "/about/:path*",
    "/c",
    "/c/:path*",
  ],
};
