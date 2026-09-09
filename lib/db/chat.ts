import type {
  ChatMessage,
  KnowledgeArticle,
  Order,
  OrderItem,
  Product,
  Shipment,
  SupportTicket,
} from "@prisma/client";
import { rankProductSearchTerms } from "@/lib/chat/intent";
import { asD1, cuidLike, getD1, sqlNow, toBool, toDate } from "@/lib/db/d1";

/** D1/SQLite rejects very large LIKE OR chains ("pattern too complex"). */
const MAX_PRODUCT_SEARCH_TERMS = 4;
const MAX_PRIMARY_SEARCH_LEN = 64;

export type ChatSessionRow = {
  id: string;
  userId: string | null;
  guestKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatProductLite = {
  title: string;
  slug: string;
  brand: string;
  category: string;
  sellingPrice: number;
  stock: number;
  description: string;
};

export type ChatOrderContext = Order & {
  items: (OrderItem & { product: Pick<Product, "title" | "slug"> })[];
  shipment: Shipment | null;
};

function mapChatSession(row: Record<string, unknown>): ChatSessionRow {
  return {
    id: String(row.id),
    userId: row.userId != null ? String(row.userId) : null,
    guestKey: row.guestKey != null ? String(row.guestKey) : null,
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

function mapArticle(row: Record<string, unknown>): KnowledgeArticle {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    question: String(row.question),
    answer: String(row.answer),
    keywords: String(row.keywords ?? "[]"),
    category: String(row.category ?? "GENERAL"),
    active: toBool(row.active),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function mapOrder(row: Record<string, unknown>): Order {
  const totalAmount = Number(row.totalAmount);
  return {
    id: String(row.id),
    orderNumber: String(row.orderNumber),
    userId: row.userId != null ? String(row.userId) : null,
    email: String(row.email),
    totalAmount,
    subtotalAmount:
      row.subtotalAmount != null ? Number(row.subtotalAmount) : totalAmount,
    discountAmount: Number(row.discountAmount ?? 0),
    shippingAmount: Number(row.shippingAmount ?? 0),
    couponCode: row.couponCode != null ? String(row.couponCode) : null,
    paymentStatus: String(row.paymentStatus),
    orderStatus: String(row.orderStatus),
    razorpayOrderId:
      row.razorpayOrderId != null ? String(row.razorpayOrderId) : null,
    razorpayPaymentId:
      row.razorpayPaymentId != null ? String(row.razorpayPaymentId) : null,
    shippingAddress: String(row.shippingAddress),
    cancelRequestedAt:
      row.cancelRequestedAt != null ? toDate(row.cancelRequestedAt) : null,
    cancelReason: row.cancelReason != null ? String(row.cancelReason) : null,
    previousOrderStatus:
      row.previousOrderStatus != null ? String(row.previousOrderStatus) : null,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function mapShipment(row: Record<string, unknown> | null): Shipment | null {
  if (!row) return null;
  return {
    id: String(row.id),
    orderId: String(row.orderId),
    shippingPartner:
      row.shippingPartner != null ? String(row.shippingPartner) : null,
    shiprocketOrderId:
      row.shiprocketOrderId != null ? String(row.shiprocketOrderId) : null,
    shipmentId: row.shipmentId != null ? String(row.shipmentId) : null,
    awbCode: row.awbCode != null ? String(row.awbCode) : null,
    courierName: row.courierName != null ? String(row.courierName) : null,
    trackingStatus:
      row.trackingStatus != null ? String(row.trackingStatus) : null,
    trackingUrl: row.trackingUrl != null ? String(row.trackingUrl) : null,
  };
}

export async function findChatSessionById(
  id: string
): Promise<ChatSessionRow | null> {
  const db = await getD1();
  if (db) {
    const row = await asD1(db)
      .prepare(`SELECT * FROM ChatSession WHERE id = ? LIMIT 1`)
      .bind(id)
      .first();
    return row ? mapChatSession(row as Record<string, unknown>) : null;
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.chatSession.findUnique({ where: { id } });
}

export async function createChatSession(opts: {
  userId?: string | null;
  guestKey: string;
}): Promise<ChatSessionRow> {
  const db = await getD1();
  if (db) {
    const id = cuidLike();
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `INSERT INTO ChatSession (id, userId, guestKey, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, opts.userId ?? null, opts.guestKey, now, now)
      .run();
    return {
      id,
      userId: opts.userId ?? null,
      guestKey: opts.guestKey,
      createdAt: toDate(now),
      updatedAt: toDate(now),
    };
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.chatSession.create({
    data: {
      userId: opts.userId || null,
      guestKey: opts.guestKey,
    },
  });
}

export async function attachUserToChatSession(
  id: string,
  userId: string
): Promise<ChatSessionRow> {
  const db = await getD1();
  if (db) {
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `UPDATE ChatSession SET userId = ?, updatedAt = ? WHERE id = ?`
      )
      .bind(userId, now, id)
      .run();
    const row = await asD1(db)
      .prepare(`SELECT * FROM ChatSession WHERE id = ? LIMIT 1`)
      .bind(id)
      .first();
    if (!row) throw new Error("Chat session not found after update");
    return mapChatSession(row as Record<string, unknown>);
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.chatSession.update({
    where: { id },
    data: { userId },
  });
}

export async function countSupportTickets(): Promise<number> {
  const db = await getD1();
  if (db) {
    const row = await asD1(db)
      .prepare(`SELECT COUNT(*) AS n FROM SupportTicket`)
      .first();
    return Number((row as { n?: number } | null)?.n ?? 0);
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.supportTicket.count();
}

export async function createChatMessage(opts: {
  sessionId: string;
  role: string;
  content: string;
  intent?: string | null;
  source?: string | null;
}): Promise<ChatMessage> {
  const db = await getD1();
  if (db) {
    const id = cuidLike();
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `INSERT INTO ChatMessage (id, sessionId, role, content, intent, source, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        opts.sessionId,
        opts.role,
        opts.content,
        opts.intent ?? null,
        opts.source ?? null,
        now
      )
      .run();
    return {
      id,
      sessionId: opts.sessionId,
      role: opts.role,
      content: opts.content,
      intent: opts.intent ?? null,
      source: opts.source ?? null,
      createdAt: toDate(now),
    };
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.chatMessage.create({
    data: {
      sessionId: opts.sessionId,
      role: opts.role,
      content: opts.content,
      intent: opts.intent ?? null,
      source: opts.source ?? null,
    },
  });
}

export async function listChatMessages(
  sessionId: string,
  take: number
): Promise<ChatMessage[]> {
  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(
        `SELECT * FROM ChatMessage WHERE sessionId = ? ORDER BY createdAt DESC LIMIT ?`
      )
      .bind(sessionId, take)
      .all();
    return ((res.results || []) as Record<string, unknown>[]).map(mapMessage);
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listActiveKnowledgeArticles(): Promise<KnowledgeArticle[]> {
  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(
        `SELECT * FROM KnowledgeArticle WHERE active = 1 ORDER BY updatedAt DESC`
      )
      .all();
    return ((res.results || []) as Record<string, unknown>[]).map(mapArticle);
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.knowledgeArticle.findMany({ where: { active: true } });
}

export async function searchProductsForChat(
  q: string,
  take: number
): Promise<ChatProductLite[]> {
  const query = q.trim();
  const db = await getD1();

  async function queryD1(search: string): Promise<ChatProductLite[]> {
    if (!db) return [];
    const d1 = asD1(db);
    if (search) {
      const like = `%${search}%`;
      const res = await d1
        .prepare(
          `SELECT title, slug, brand, category, sellingPrice, stock, description
           FROM Product
           WHERE isHidden = 0
             AND (title LIKE ? OR brand LIKE ? OR category LIKE ?)
           ORDER BY reviewCount DESC
           LIMIT ?`
        )
        .bind(like, like, like, take)
        .all();
      return ((res.results || []) as Record<string, unknown>[]).map((row) => ({
        title: String(row.title),
        slug: String(row.slug),
        brand: String(row.brand),
        category: String(row.category),
        sellingPrice: Number(row.sellingPrice),
        stock: Number(row.stock ?? 0),
        description: String(row.description ?? ""),
      }));
    }
    const res = await d1
      .prepare(
        `SELECT title, slug, brand, category, sellingPrice, stock, description
         FROM Product
         WHERE isHidden = 0
         ORDER BY reviewCount DESC
         LIMIT ?`
      )
      .bind(take)
      .all();
    return ((res.results || []) as Record<string, unknown>[]).map((row) => ({
      title: String(row.title),
      slug: String(row.slug),
      brand: String(row.brand),
      category: String(row.category),
      sellingPrice: Number(row.sellingPrice),
      stock: Number(row.stock ?? 0),
      description: String(row.description ?? ""),
    }));
  }

  async function queryD1ByTerms(terms: string[]): Promise<ChatProductLite[]> {
    if (!db || terms.length === 0) return [];
    const capped = terms.slice(0, MAX_PRODUCT_SEARCH_TERMS);
    const d1 = asD1(db);
    const conditions = capped.map(() => "(title LIKE ? OR brand LIKE ?)").join(" OR ");
    const binds = capped.flatMap((t) => [`%${t}%`, `%${t}%`]);
    const res = await d1
      .prepare(
        `SELECT title, slug, brand, category, sellingPrice, stock, description
         FROM Product
         WHERE isHidden = 0 AND (${conditions})
         ORDER BY reviewCount DESC
         LIMIT ?`
      )
      .bind(...binds, take)
      .all();
    return ((res.results || []) as Record<string, unknown>[]).map((row) => ({
      title: String(row.title),
      slug: String(row.slug),
      brand: String(row.brand),
      category: String(row.category),
      sellingPrice: Number(row.sellingPrice),
      stock: Number(row.stock ?? 0),
      description: String(row.description ?? ""),
    }));
  }

  if (db) {
    if (query) {
      const primaryQuery =
        query.length > MAX_PRIMARY_SEARCH_LEN
          ? rankProductSearchTerms(query, 3).join(" ") || query.slice(0, MAX_PRIMARY_SEARCH_LEN)
          : query;

      try {
        const primary = await queryD1(primaryQuery);
        if (primary.length > 0) return primary;

        const terms = rankProductSearchTerms(query, MAX_PRODUCT_SEARCH_TERMS);
        if (terms.length >= 1) {
          try {
            const fallback = await queryD1ByTerms(terms);
            if (fallback.length > 0) return fallback;
          } catch (termErr) {
            console.warn("[chat] product term search failed:", termErr);
            for (const term of terms) {
              try {
                const single = await queryD1(term);
                if (single.length > 0) return single;
              } catch {
                // try next term
              }
            }
          }
        }
      } catch (searchErr) {
        console.warn("[chat] product search failed:", searchErr);
      }
    }
    return queryD1("");
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  if (query) {
    const products = await prisma.product.findMany({
      where: {
        isHidden: false,
        OR: [
          { title: { contains: query } },
          { brand: { contains: query } },
          { category: { contains: query } },
        ],
      },
      orderBy: { reviewCount: "desc" },
      take,
      select: {
        title: true,
        slug: true,
        brand: true,
        category: true,
        sellingPrice: true,
        stock: true,
        description: true,
      },
    });
    if (products.length > 0) return products;

    const terms = rankProductSearchTerms(query, MAX_PRODUCT_SEARCH_TERMS);
    if (terms.length >= 1) {
      const byTerms = await prisma.product.findMany({
        where: {
          isHidden: false,
          OR: terms.flatMap((t) => [
            { title: { contains: t } },
            { brand: { contains: t } },
          ]),
        },
        orderBy: { reviewCount: "desc" },
        take,
        select: {
          title: true,
          slug: true,
          brand: true,
          category: true,
          sellingPrice: true,
          stock: true,
          description: true,
        },
      });
      if (byTerms.length > 0) return byTerms;
    }
  }

  return prisma.product.findMany({
    where: { isHidden: false },
    orderBy: { reviewCount: "desc" },
    take,
    select: {
      title: true,
      slug: true,
      brand: true,
      category: true,
      sellingPrice: true,
      stock: true,
      description: true,
    },
  });
}

export async function listRecentOrdersForUser(
  userIdOrEmail: { userId?: string | null; email?: string | null },
  take: number
): Promise<ChatOrderContext[]> {
  const userId = userIdOrEmail.userId?.trim() || null;
  const email = userIdOrEmail.email?.trim() || null;
  if (!userId && !email) return [];

  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    let orderRows: Record<string, unknown>[] = [];
    if (userId && email) {
      const res = await d1
        .prepare(
          `SELECT * FROM "Order"
           WHERE userId = ? OR email = ?
           ORDER BY createdAt DESC
           LIMIT ?`
        )
        .bind(userId, email, take)
        .all();
      orderRows = (res.results || []) as Record<string, unknown>[];
    } else if (userId) {
      const res = await d1
        .prepare(
          `SELECT * FROM "Order" WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`
        )
        .bind(userId, take)
        .all();
      orderRows = (res.results || []) as Record<string, unknown>[];
    } else {
      const res = await d1
        .prepare(
          `SELECT * FROM "Order" WHERE email = ? ORDER BY createdAt DESC LIMIT ?`
        )
        .bind(email, take)
        .all();
      orderRows = (res.results || []) as Record<string, unknown>[];
    }

    const out: ChatOrderContext[] = [];
    for (const row of orderRows) {
      const order = mapOrder(row);
      const itemsRes = await d1
        .prepare(`SELECT * FROM OrderItem WHERE orderId = ?`)
        .bind(order.id)
        .all();
      const items: ChatOrderContext["items"] = [];
      for (const ir of (itemsRes.results || []) as Record<string, unknown>[]) {
        const productId = String(ir.productId);
        const prod = await d1
          .prepare(`SELECT title, slug FROM Product WHERE id = ? LIMIT 1`)
          .bind(productId)
          .first();
        if (!prod) continue;
        items.push({
          id: String(ir.id),
          orderId: String(ir.orderId),
          productId,
          variantId: ir.variantId != null ? String(ir.variantId) : null,
          quantity: Number(ir.quantity),
          price: Number(ir.price),
          product: {
            title: String((prod as { title: string }).title),
            slug: String((prod as { slug: string }).slug),
          },
        });
      }
      const shipRow = await d1
        .prepare(`SELECT * FROM Shipment WHERE orderId = ? LIMIT 1`)
        .bind(order.id)
        .first();
      out.push({
        ...order,
        items,
        shipment: mapShipment(shipRow as Record<string, unknown> | null),
      });
    }
    return out;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.order.findMany({
    where: {
      OR: [
        ...(userId ? [{ userId }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
    include: {
      items: { include: { product: { select: { title: true, slug: true } } } },
      shipment: true,
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function createSupportTicket(opts: {
  ticketNumber: string;
  userId?: string | null;
  email: string;
  name?: string | null;
  subject: string;
  description: string;
  status?: string;
  category: string;
  tatHours: number;
  dueAt: Date;
  sessionId?: string | null;
}): Promise<SupportTicket> {
  const db = await getD1();
  if (db) {
    const id = cuidLike();
    const now = sqlNow();
    const status = opts.status ?? "OPEN";
    const dueAtIso = opts.dueAt.toISOString();
    await asD1(db)
      .prepare(
        `INSERT INTO SupportTicket
         (id, ticketNumber, userId, email, name, subject, description, status, category, tatHours, dueAt, sessionId, adminReply, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
      )
      .bind(
        id,
        opts.ticketNumber,
        opts.userId ?? null,
        opts.email,
        opts.name ?? null,
        opts.subject,
        opts.description,
        status,
        opts.category,
        opts.tatHours,
        dueAtIso,
        opts.sessionId ?? null,
        now,
        now
      )
      .run();
    return {
      id,
      ticketNumber: opts.ticketNumber,
      userId: opts.userId ?? null,
      email: opts.email,
      name: opts.name ?? null,
      subject: opts.subject,
      description: opts.description,
      status,
      category: opts.category,
      tatHours: opts.tatHours,
      dueAt: opts.dueAt,
      sessionId: opts.sessionId ?? null,
      adminReply: null,
      createdAt: toDate(now),
      updatedAt: toDate(now),
    };
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.supportTicket.create({
    data: {
      ticketNumber: opts.ticketNumber,
      userId: opts.userId ?? null,
      email: opts.email,
      name: opts.name ?? null,
      subject: opts.subject,
      description: opts.description,
      status: opts.status ?? "OPEN",
      category: opts.category,
      tatHours: opts.tatHours,
      dueAt: opts.dueAt,
      sessionId: opts.sessionId ?? null,
    },
  });
}

/** Answer-cache rows used by lib/chat/answer-cache.ts */
export type ChatAnswerCacheRow = {
  id: string;
  questionText: string;
  questionNormalized: string;
  answer: string;
  source: string;
  intent: string | null;
  keywords: string;
  hitCount: number;
  lastHitAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function mapCache(row: Record<string, unknown>): ChatAnswerCacheRow {
  return {
    id: String(row.id),
    questionText: String(row.questionText),
    questionNormalized: String(row.questionNormalized),
    answer: String(row.answer),
    source: String(row.source ?? "gemini"),
    intent: row.intent != null ? String(row.intent) : null,
    keywords: String(row.keywords ?? "[]"),
    hitCount: Number(row.hitCount ?? 0),
    lastHitAt: row.lastHitAt != null ? toDate(row.lastHitAt) : null,
    active: toBool(row.active),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

export async function listActiveAnswerCache(
  take: number
): Promise<ChatAnswerCacheRow[]> {
  const db = await getD1();
  if (db) {
    const res = await asD1(db)
      .prepare(
        `SELECT * FROM ChatAnswerCache
         WHERE active = 1
         ORDER BY hitCount DESC, updatedAt DESC
         LIMIT ?`
      )
      .bind(take)
      .all();
    return ((res.results || []) as Record<string, unknown>[]).map(mapCache);
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  return prisma.chatAnswerCache.findMany({
    where: { active: true },
    orderBy: [{ hitCount: "desc" }, { updatedAt: "desc" }],
    take,
  });
}

export async function incrementAnswerCacheHit(id: string): Promise<void> {
  const db = await getD1();
  if (db) {
    const now = sqlNow();
    await asD1(db)
      .prepare(
        `UPDATE ChatAnswerCache
         SET hitCount = hitCount + 1, lastHitAt = ?, updatedAt = ?
         WHERE id = ?`
      )
      .bind(now, now, id)
      .run();
    return;
  }
  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  await prisma.chatAnswerCache.update({
    where: { id },
    data: {
      hitCount: { increment: 1 },
      lastHitAt: new Date(),
    },
  });
}

export async function upsertAnswerCache(opts: {
  questionText: string;
  questionNormalized: string;
  answer: string;
  source: string;
  intent?: string | null;
  keywords: string;
}): Promise<void> {
  const db = await getD1();
  if (db) {
    const d1 = asD1(db);
    const now = sqlNow();
    const existing = await d1
      .prepare(
        `SELECT id FROM ChatAnswerCache WHERE questionNormalized = ? LIMIT 1`
      )
      .bind(opts.questionNormalized)
      .first();
    if (existing) {
      await d1
        .prepare(
          `UPDATE ChatAnswerCache
           SET questionText = ?, answer = ?, source = ?, intent = ?, keywords = ?, active = 1, updatedAt = ?
           WHERE questionNormalized = ?`
        )
        .bind(
          opts.questionText,
          opts.answer,
          opts.source,
          opts.intent ?? null,
          opts.keywords,
          now,
          opts.questionNormalized
        )
        .run();
    } else {
      await d1
        .prepare(
          `INSERT INTO ChatAnswerCache
           (id, questionText, questionNormalized, answer, source, intent, keywords, hitCount, lastHitAt, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, 1, ?, ?)`
        )
        .bind(
          cuidLike(),
          opts.questionText,
          opts.questionNormalized,
          opts.answer,
          opts.source,
          opts.intent ?? null,
          opts.keywords,
          now,
          now
        )
        .run();
    }
    return;
  }

  const { getPrismaAsync } = await import("@/lib/prisma");
  const prisma = await getPrismaAsync();
  await prisma.chatAnswerCache.upsert({
    where: { questionNormalized: opts.questionNormalized },
    create: {
      questionText: opts.questionText,
      questionNormalized: opts.questionNormalized,
      answer: opts.answer,
      source: opts.source,
      intent: opts.intent ?? null,
      keywords: opts.keywords,
      hitCount: 0,
      active: true,
    },
    update: {
      questionText: opts.questionText,
      answer: opts.answer,
      source: opts.source,
      intent: opts.intent ?? null,
      keywords: opts.keywords,
      active: true,
    },
  });
}
