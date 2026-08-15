import { auth } from "@/auth";

/** Dev-only bypass — never honored in production builds */
export function isAdminDevBypass() {
  return (
    process.env.NODE_ENV === "development" && process.env.ADMIN_DEV_BYPASS === "true"
  );
}

export async function requireAdmin() {
  if (isAdminDevBypass()) return { id: "dev", role: "ADMIN" as const };

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function requireAdminApi() {
  if (isAdminDevBypass()) return { id: "dev", role: "ADMIN" as const };

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null;
  }
  return session.user;
}
