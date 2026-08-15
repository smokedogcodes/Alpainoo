import { Suspense } from "react";
import { auth } from "@/auth";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ShopAuthBanner } from "@/components/layout/shop-auth-banner";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userEmail = session?.user?.email ?? null;
  const userRole = session?.user?.role ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader userEmail={userEmail} userRole={userRole} />
      <Suspense fallback={null}>
        <ShopAuthBanner />
      </Suspense>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
