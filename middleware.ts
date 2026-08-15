import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminDevBypass } from "@/lib/auth/admin";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isAdminPage = path.startsWith("/admin");
  const isAdminApi = path.startsWith("/api/admin");

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
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("error", req.auth ? "unauthorized" : "login");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
