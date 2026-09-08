import { requireAdmin } from "@/lib/auth/admin";
import { getRoleTemplates } from "@/lib/db/role-templates";
import { RoleDefaultsForm } from "@/components/admin/role-defaults-form";

export default async function AdminRoleDefaultsPage() {
  await requireAdmin();
  const templates = await getRoleTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Role defaults</h1>
        <p className="mt-1 text-sm text-muted">
          Configure the default View / Edit / Delete matrix for Staff and Temp roles. Only Admins
          can change these. Per-user overrides on the Users page take precedence when set.
        </p>
      </div>
      <RoleDefaultsForm initial={templates} />
    </div>
  );
}
