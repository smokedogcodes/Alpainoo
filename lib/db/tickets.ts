import type { ChatMessage, SupportTicket, User } from "@prisma/client";
import { asD1, getD1, sqlNow, toDate } from "@/lib/db/d1";

export type TicketListItem = SupportTicket & {
  user: Pick<User, "id" | "name" | "email"> | null;
};

export type TicketDetail = SupportTicket & {
  user: Pick<User, "id" | "name" | "email" | "role" | "createdAt"> | null;
  session: {
    id: string;
    messages: ChatMessage[];
  } | null;
};

function mapTicket(row: Record<string, unknown>): SupportTicket {
  return {
    id: String(row.id),
    ticketNumber: String(row.ticketNumber),
    userId: row.userId != null ? String(row.userId) : null,
    email: String(row.email),
    name: row.name != null ? String(row.name) : null,
    subject: String(row.subject),
    description: String(row.description),
    status: String(row.status ?? "OPEN"),
    category: String(row.category ?? "GENERAL"),
    tatHours: Number(row.tatHours ?? 24),
    dueAt: toDate(row.dueAt),
    sessionId: row.sessionId != null ? String(row.sessionId) : null,
    adminReply: row.adminReply != null ? String(row.adminReply) : null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function mapMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    sessionId: String(row.sessionId),
    role: String(row.role),
    content: String(row.content),
    intent: row.intent != null ? String(row.intent) : null,
    source: row.source != null ? String(row.source) : null,
    createdAt: toDate(row.createdAt),
  };
}

export async function listAdminTickets(opts?: {
  status?: string;
}): Promise<TicketListItem[]> {
  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    const res = opts?.status
      ? await d1
          .prepare(
            `SELECT * FROM SupportTicket WHERE status = ? ORDER BY createdAt DESC`
          )
          .bind(opts.status)
          .all()
      : await d1
          .prepare(`SELECT * FROM SupportTicket ORDER BY createdAt DESC`)
          .all();

    const out: TicketListItem[] = [];
    for (const row of (res.results || []) as Record<string, unknown>[]) {
      const ticket = mapTicket(row);
      let user: TicketListItem["user"] = null;
      if (ticket.userId) {
        const u = await d1
          .prepare(`SELECT id, name, email FROM User WHERE id = ? LIMIT 1`)
          .bind(ticket.userId)
          .first();
        if (u) {
          user = {
            id: String(u.id),
            name: u.name != null ? String(u.name) : null,
            email: String(u.email),
          };
        }
      }
      out.push({ ...ticket, user });
    }
    return out;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.supportTicket.findMany({
    where: opts?.status ? { status: opts.status } : {},
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminTicket(id: string): Promise<TicketDetail | null> {
  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    const row = await d1
      .prepare(`SELECT * FROM SupportTicket WHERE id = ? LIMIT 1`)
      .bind(id)
      .first();
    if (!row) return null;
    const ticket = mapTicket(row as Record<string, unknown>);

    let user: TicketDetail["user"] = null;
    if (ticket.userId) {
      const u = await d1
        .prepare(
          `SELECT id, name, email, role, createdAt FROM User WHERE id = ? LIMIT 1`
        )
        .bind(ticket.userId)
        .first();
      if (u) {
        user = {
          id: String(u.id),
          name: u.name != null ? String(u.name) : null,
          email: String(u.email),
          role: String(u.role ?? "CUSTOMER"),
          createdAt: toDate(u.createdAt),
        };
      }
    }

    let session: TicketDetail["session"] = null;
    if (ticket.sessionId) {
      const msgs = await d1
        .prepare(
          `SELECT * FROM ChatMessage WHERE sessionId = ? ORDER BY createdAt ASC`
        )
        .bind(ticket.sessionId)
        .all();
      session = {
        id: ticket.sessionId,
        messages: ((msgs.results || []) as Record<string, unknown>[]).map(
          mapMessage
        ),
      };
    }

    return { ...ticket, user, session };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      },
      session: {
        include: { messages: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
}

export async function updateTicketFields(
  id: string,
  data: { status?: string; adminReply?: string }
) {
  const db = await getD1();
  if (db) {
    const sets: string[] = ["updatedAt = ?"];
    const binds: unknown[] = [sqlNow()];
    if (data.status != null) {
      sets.push("status = ?");
      binds.push(data.status);
    }
    if (data.adminReply != null) {
      sets.push("adminReply = ?");
      binds.push(data.adminReply);
    }
    binds.push(id);
    await asD1(db)
      .prepare(`UPDATE SupportTicket SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...binds)
      .run();
    return;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  await prisma.supportTicket.update({ where: { id }, data });
}
