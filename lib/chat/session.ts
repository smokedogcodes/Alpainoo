import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function resolveChatSession(opts: {
  sessionId?: string | null;
  userId?: string | null;
}) {
  const requested = opts.sessionId?.trim() || null;

  if (requested) {
    const existing = await prisma.chatSession.findUnique({ where: { id: requested } });
    if (existing) {
      if (opts.userId && !existing.userId) {
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
