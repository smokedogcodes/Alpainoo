import type { User } from "@prisma/client";
import { asD1, cuidLike, getD1, sqlNow, toDate } from "@/lib/db/d1";
import type { AssignableRole } from "@/lib/auth/permissions";

function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    name: row.name != null ? String(row.name) : null,
    email: String(row.email),
    emailVerified: row.emailVerified != null ? toDate(row.emailVerified) : null,
    image: row.image != null ? String(row.image) : null,
    role: String(row.role ?? "CUSTOMER"),
    permissions: String(row.permissions ?? "[]"),
    roleExpiresAt: row.roleExpiresAt != null ? toDate(row.roleExpiresAt) : null,
    avatarUrl: row.avatarUrl != null ? String(row.avatarUrl) : null,
    phone: row.phone != null ? String(row.phone) : null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export async function upsertUserByEmail(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<User> {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    return prisma.user.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        name: input.name || null,
        image: input.image || null,
        avatarUrl: input.image || null,
      },
      update: {},
    });
  }

  const d1 = asD1(db);
  const existing = await d1
    .prepare(`SELECT * FROM User WHERE email = ? LIMIT 1`)
    .bind(input.email)
    .first();
  if (existing) return mapUser(existing as Record<string, unknown>);

  const id = cuidLike();
  const now = sqlNow();
  await d1
    .prepare(
      `INSERT INTO User (id, name, email, image, role, permissions, avatarUrl, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'CUSTOMER', '[]', ?, ?, ?)`
    )
    .bind(
      id,
      input.name || null,
      input.email,
      input.image || null,
      input.image || null,
      now,
      now
    )
    .run();

  const row = await d1
    .prepare(`SELECT * FROM User WHERE id = ? LIMIT 1`)
    .bind(id)
    .first();
  return mapUser(row as Record<string, unknown>);
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    return prisma.user.findUnique({ where: { id } });
  }
  const row = await asD1(db)
    .prepare(`SELECT * FROM User WHERE id = ? LIMIT 1`)
    .bind(id)
    .first();
  return row ? mapUser(row as Record<string, unknown>) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    return prisma.user.findUnique({ where: { email } });
  }
  const row = await asD1(db)
    .prepare(`SELECT * FROM User WHERE email = ? LIMIT 1`)
    .bind(email)
    .first();
  return row ? mapUser(row as Record<string, unknown>) : null;
}

export async function listUsers() {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    return prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  }
  const res = await asD1(db)
    .prepare(`SELECT * FROM User ORDER BY createdAt DESC`)
    .all();
  return (res.results || []).map((r: Record<string, unknown>) => mapUser(r));
}

export async function updateUserRole(userId: string, role: string) {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    return prisma.user.update({ where: { id: userId }, data: { role } });
  }
  await asD1(db)
    .prepare(`UPDATE User SET role = ?, updatedAt = ? WHERE id = ?`)
    .bind(role, sqlNow(), userId)
    .run();
  return findUserById(userId);
}

export async function updateUserAccess(
  userId: string,
  data: {
    role: AssignableRole;
    permissions: string;
    roleExpiresAt: Date | null;
  }
): Promise<User | null> {
  const expiresIso = data.roleExpiresAt ? data.roleExpiresAt.toISOString() : null;
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    return prisma.user.update({
      where: { id: userId },
      data: {
        role: data.role,
        permissions: data.permissions,
        roleExpiresAt: data.roleExpiresAt,
      },
    });
  }
  await asD1(db)
    .prepare(
      `UPDATE User SET role = ?, permissions = ?, roleExpiresAt = ?, updatedAt = ? WHERE id = ?`
    )
    .bind(data.role, data.permissions, expiresIso, sqlNow(), userId)
    .run();
  return findUserById(userId);
}

export async function updateUserProfile(
  userId: string,
  data: { name: string; phone: string | null }
): Promise<User | null> {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    return prisma.user.update({
      where: { id: userId },
      data: { name: data.name, phone: data.phone },
    });
  }
  await asD1(db)
    .prepare(`UPDATE User SET name = ?, phone = ?, updatedAt = ? WHERE id = ?`)
    .bind(data.name, data.phone, sqlNow(), userId)
    .run();
  return findUserById(userId);
}
