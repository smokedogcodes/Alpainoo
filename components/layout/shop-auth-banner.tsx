"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ShopAuthBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const error = searchParams.get("error");

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("error");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    }, 8000);
    return () => clearTimeout(t);
  }, [error, pathname, router, searchParams]);

  if (error === "unauthorized") {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-950">
        You don&apos;t have access to the admin portal. Contact an existing admin if you need access.
      </div>
    );
  }

  if (error === "login") {
    return (
      <div className="border-b border-border bg-off-white px-4 py-2.5 text-center text-sm text-muted">
        Please sign in with Google to continue.
      </div>
    );
  }

  return null;
}
