import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type AppUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

/** Require a signed-in user with a stable id. Redirects to login otherwise. */
export async function requireUser(opts?: { callbackPath?: string }): Promise<AppUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) {
    if (opts?.callbackPath) {
      redirect(`/?error=login&next=${encodeURIComponent(opts.callbackPath)}`);
    }
    redirect("/?error=login");
  }
  return {
    id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

/** Same as requireUser but returns null for API routes (no redirect). */
export async function requireUserApi(): Promise<AppUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

/** Ownership filter: order must belong to this user id or matching email. */
export function orderOwnerWhere(user: { id: string; email?: string | null }) {
  return {
    OR: [
      { userId: user.id },
      ...(user.email ? [{ email: user.email }] : []),
    ],
  };
}
