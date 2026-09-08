"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { saveRoleTemplates } from "@/lib/db/role-templates";
import {
  parsePermissionMatrix,
  type PermissionMatrix,
  type RoleTemplates,
  serializeRoleTemplates,
  defaultRoleTemplates,
} from "@/lib/auth/permissions";

export async function saveRoleTemplatesAction(input: {
  STAFF: PermissionMatrix;
  TEMP: PermissionMatrix;
}) {
  await requireAdmin();
  const templates: RoleTemplates = {
    STAFF: input.STAFF,
    TEMP: input.TEMP,
  };
  // Ensure users/roles stay off on templates for non-admins
  templates.STAFF.users = { view: false, edit: false, delete: false };
  templates.STAFF.roles = { view: false, edit: false, delete: false };
  templates.TEMP.users = { view: false, edit: false, delete: false };
  templates.TEMP.roles = { view: false, edit: false, delete: false };

  await saveRoleTemplates(templates);
  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
  return { ok: true as const, json: serializeRoleTemplates(templates) };
}

export async function resetRoleTemplatesAction() {
  await requireAdmin();
  await saveRoleTemplates(defaultRoleTemplates());
  revalidatePath("/admin/roles");
  return { ok: true as const };
}

/** Validate client-submitted matrix */
export async function parseMatrixOrThrow(raw: unknown): Promise<PermissionMatrix> {
  const parsed = parsePermissionMatrix(JSON.stringify(raw));
  if (!parsed) throw new Error("Invalid permission matrix");
  return parsed;
}
