import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/admin";
import type { AdminScreen } from "@/lib/auth/permissions";

/** Page-level view guard — redirects home on deny instead of throwing. */
export async function requireScreenView(screen: AdminScreen) {
  try {
    await requirePermission(screen, "view");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[admin] requireScreenView(${screen}):`, msg);
    redirect("/?error=unauthorized");
  }
}
