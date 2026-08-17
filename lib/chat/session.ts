import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

/**
 * Resume chat only via httpOnly cookie — never trust a client-supplied sessionId alone (IDOR).
 */
export async function resolveChatSession(opts: {
  userId?: string | null;
  cookieSessionId?: string | null;
}) {
  const cookieId = opts.cookieSessionId?.trim() || null;

  if (cookieId) {
    const existing = await prisma.chatSession.findUnique({ where: { id: cookieId } });
    if (existing) {
      if (existing.userId) {
        if (opts.userId && existing.userId === opts.userId) {
          return { session: existing, setCookie: false as const };
        }
        // Cookie points at another user's session — do not reuse
      } else {
        if (opts.userId) {
          return {
            session: await prisma.chatSession.update({
              where: { id: existing.id },
              data: { userId: opts.userId },
            }),
            setCookie: false as const,
          };
        }
        return { session: existing, setCookie: false as const };
      }
    }
  }

  const guestKey = randomBytes(16).toString("hex");
  const created = await prisma.chatSession.create({
    data: {
      userId: opts.userId || null,
      guestKey,
    },
  });

  return { session: created, setCookie: true as const };
}

export async function nextTicketNumber() {
  const n = await prisma.supportTicket.count();
  const seq = String(n + 1).padStart(5, "0");
  return `TKT-${seq}`;
}

export const CHAT_SESSION_COOKIE = "elorakart_chat_session";
