import { asD1, cuidLike, getD1, sqlNow, toBool, toDate } from "@/lib/db/d1";

export type SavedAddressRow = {
  id: string;
  userId: string;
  label: string | null;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function mapAddress(row: Record<string, unknown>): SavedAddressRow {
  return {
    id: String(row.id),
    userId: String(row.userId),
    label: row.label != null ? String(row.label) : null,
    name: String(row.name),
    phone: String(row.phone),
    address: String(row.address),
    city: String(row.city),
    state: String(row.state),
    pincode: String(row.pincode),
    isDefault: toBool(row.isDefault),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export async function listSavedAddresses(userId: string): Promise<SavedAddressRow[]> {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const rows = await prisma.savedAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      label: r.label,
      name: r.name,
      phone: r.phone,
      address: r.address,
      city: r.city,
      state: r.state,
      pincode: r.pincode,
      isDefault: r.isDefault,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  const res = await asD1(db)
    .prepare(
      `SELECT * FROM SavedAddress WHERE userId = ? ORDER BY isDefault DESC, updatedAt DESC`
    )
    .bind(userId)
    .all();
  return (res.results || []).map((r: Record<string, unknown>) => mapAddress(r));
}

export async function getDefaultSavedAddress(
  userId: string
): Promise<SavedAddressRow | null> {
  const addresses = await listSavedAddresses(userId);
  return addresses.find((a) => a.isDefault) || addresses[0] || null;
}

export async function createSavedAddress(input: {
  userId: string;
  label?: string | null;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}): Promise<SavedAddressRow> {
  const db = await getD1();
  const makeDefault = Boolean(input.isDefault);

  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    if (makeDefault) {
      await prisma.savedAddress.updateMany({
        where: { userId: input.userId },
        data: { isDefault: false },
      });
    }
    const created = await prisma.savedAddress.create({
      data: {
        userId: input.userId,
        label: input.label || null,
        name: input.name,
        phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        isDefault: makeDefault,
      },
    });
    return {
      id: created.id,
      userId: created.userId,
      label: created.label,
      name: created.name,
      phone: created.phone,
      address: created.address,
      city: created.city,
      state: created.state,
      pincode: created.pincode,
      isDefault: created.isDefault,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  const d1 = asD1(db);
  const now = sqlNow();
  const id = cuidLike();
  if (makeDefault) {
    await d1
      .prepare(`UPDATE SavedAddress SET isDefault = 0, updatedAt = ? WHERE userId = ?`)
      .bind(now, input.userId)
      .run();
  }
  await d1
    .prepare(
      `INSERT INTO SavedAddress
        (id, userId, label, name, phone, address, city, state, pincode, isDefault, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.userId,
      input.label || null,
      input.name,
      input.phone,
      input.address,
      input.city,
      input.state,
      input.pincode,
      makeDefault ? 1 : 0,
      now,
      now
    )
    .run();

  const row = await d1
    .prepare(`SELECT * FROM SavedAddress WHERE id = ? LIMIT 1`)
    .bind(id)
    .first();
  return mapAddress(row as Record<string, unknown>);
}

export async function updateSavedAddress(input: {
  id: string;
  userId: string;
  label?: string | null;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}): Promise<void> {
  const db = await getD1();
  const makeDefault = Boolean(input.isDefault);

  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const existing = await prisma.savedAddress.findFirst({
      where: { id: input.id, userId: input.userId },
    });
    if (!existing) throw new Error("Address not found");
    if (makeDefault) {
      await prisma.savedAddress.updateMany({
        where: { userId: input.userId },
        data: { isDefault: false },
      });
    }
    await prisma.savedAddress.update({
      where: { id: input.id },
      data: {
        label: input.label || null,
        name: input.name,
        phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        isDefault: makeDefault,
      },
    });
    return;
  }

  const d1 = asD1(db);
  const existing = await d1
    .prepare(`SELECT id FROM SavedAddress WHERE id = ? AND userId = ? LIMIT 1`)
    .bind(input.id, input.userId)
    .first();
  if (!existing) throw new Error("Address not found");

  const now = sqlNow();
  if (makeDefault) {
    await d1
      .prepare(`UPDATE SavedAddress SET isDefault = 0, updatedAt = ? WHERE userId = ?`)
      .bind(now, input.userId)
      .run();
  }
  await d1
    .prepare(
      `UPDATE SavedAddress
       SET label = ?, name = ?, phone = ?, address = ?, city = ?, state = ?, pincode = ?,
           isDefault = ?, updatedAt = ?
       WHERE id = ? AND userId = ?`
    )
    .bind(
      input.label || null,
      input.name,
      input.phone,
      input.address,
      input.city,
      input.state,
      input.pincode,
      makeDefault ? 1 : 0,
      now,
      input.id,
      input.userId
    )
    .run();
}

export async function deleteSavedAddress(id: string, userId: string): Promise<void> {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const existing = await prisma.savedAddress.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Address not found");
    await prisma.savedAddress.delete({ where: { id } });
    return;
  }

  const result = await asD1(db)
    .prepare(`DELETE FROM SavedAddress WHERE id = ? AND userId = ?`)
    .bind(id, userId)
    .run();
  if (!result?.meta?.changes) throw new Error("Address not found");
}

export async function setDefaultSavedAddress(id: string, userId: string): Promise<void> {
  const db = await getD1();
  if (!db) {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const existing = await prisma.savedAddress.findFirst({ where: { id, userId } });
    if (!existing) throw new Error("Address not found");
    await prisma.savedAddress.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
    await prisma.savedAddress.update({
      where: { id },
      data: { isDefault: true },
    });
    return;
  }

  const d1 = asD1(db);
  const existing = await d1
    .prepare(`SELECT id FROM SavedAddress WHERE id = ? AND userId = ? LIMIT 1`)
    .bind(id, userId)
    .first();
  if (!existing) throw new Error("Address not found");
  const now = sqlNow();
  await d1
    .prepare(`UPDATE SavedAddress SET isDefault = 0, updatedAt = ? WHERE userId = ?`)
    .bind(now, userId)
    .run();
  await d1
    .prepare(`UPDATE SavedAddress SET isDefault = 1, updatedAt = ? WHERE id = ? AND userId = ?`)
    .bind(now, id, userId)
    .run();
}
