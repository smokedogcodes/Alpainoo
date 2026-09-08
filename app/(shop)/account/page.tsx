import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getAccountAddresses, getAccountProfile } from "@/lib/actions/account";
import { AccountHub } from "@/components/account/account-hub";
import { AccountTickets } from "@/components/account/account-tickets";
import { listCustomerTickets } from "@/lib/db/tickets";
import { opaqueHref } from "@/lib/security/opaque-routes";

export default async function AccountPage() {
  const user = await requireUser({ callbackPath: "/account" });
  const [profile, addresses, tickets] = await Promise.all([
    getAccountProfile(),
    getAccountAddresses(),
    listCustomerTickets({ userId: user.id, email: user.email || "" }),
  ]);

  return (
    <div className="mx-auto max-w-store px-4 py-10 md:px-6">
      <h1 className="font-display text-3xl text-sage md:text-4xl">Account</h1>
      <p className="mt-2 text-sm text-muted">
        Manage your profile, addresses, and support tickets.{" "}
        <Link href={opaqueHref("/orders")} className="text-sage underline">
          View orders
        </Link>
        {" · "}
        <Link href={opaqueHref("/wishlist")} className="text-sage underline">
          Wishlist
        </Link>
      </p>
      <div className="mt-8 space-y-12">
        <AccountHub profile={profile} addresses={addresses} userId={user.id} />
        <AccountTickets tickets={tickets} />
      </div>
    </div>
  );
}
