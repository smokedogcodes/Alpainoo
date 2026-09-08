import { requireScreenView } from "@/lib/auth/require-screen";
import { AdminReportsClient } from "@/components/admin/reports-client";

export default async function AdminReportsPage() {
  await requireScreenView("reports");
  return <AdminReportsClient />;
}
