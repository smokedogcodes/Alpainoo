import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
  if (!isAdminRoute) {
    return NextResponse.next();
  }

  if (process.env.ADMIN_DEV_BYPASS === "true") {
    return NextResponse.next();
  }

  const role = req.auth?.user?.role;
  if (!req.auth?.user || role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("error", req.auth ? "unauthorized" : "login");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
