import { asD1, getD1 } from "@/lib/db/d1";
import {
  defaultRoleTemplates,
  parseRoleTemplates,
  serializeRoleTemplates,
  type RoleTemplates,
} from "@/lib/auth/permissions";

export async function getRoleTemplates(): Promise<RoleTemplates> {
  const db = await getD1();
  if (db) {
    try {
      const row = await asD1(db)
        .prepare(`SELECT adminRoleTemplates FROM SiteSettings WHERE id = 'default' LIMIT 1`)
        .first();
      const raw =
        row && (row as { adminRoleTemplates?: string | null }).adminRoleTemplates != null
          ? String((row as { adminRoleTemplates: string }).adminRoleTemplates)
          : null;
      return parseRoleTemplates(raw);
    } catch {
      return defaultRoleTemplates();
    }
  }

  try {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const row = await prisma.siteSettings.findUnique({ where: { id: "default" } });
    return parseRoleTemplates(
      (row as { adminRoleTemplates?: string | null } | null)?.adminRoleTemplates ?? null
    );
  } catch {
    return defaultRoleTemplates();
  }
}

export async function saveRoleTemplates(templates: RoleTemplates): Promise<void> {
  const json = serializeRoleTemplates(templates);
  const db = await getD1();
  if (db) {
    const existing = await asD1(db)
      .prepare(`SELECT id FROM SiteSettings WHERE id = 'default' LIMIT 1`)
      .first()
      .catch(() => null);
    if (existing) {
      await asD1(db)
        .prepare(`UPDATE SiteSettings SET adminRoleTemplates = ? WHERE id = 'default'`)
        .bind(json)
        .run();
    } else {
      await asD1(db)
        .prepare(
          `INSERT INTO SiteSettings (id, invoicePrefix, lowStockDefault, adminRoleTemplates)
           VALUES ('default', 'ALP', 5, ?)`
        )
        .bind(json)
        .run();
    }
    return;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  await prisma.siteSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      adminRoleTemplates: json,
    },
    update: { adminRoleTemplates: json },
  });
}
