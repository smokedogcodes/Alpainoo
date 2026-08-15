import { auth } from "@/auth";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userEmail = session?.user?.email ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader userEmail={userEmail} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
