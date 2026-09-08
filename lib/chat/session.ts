import {
  attachUserToChatSession,
  countSupportTickets,
  createChatSession,
  findChatSessionById,
  type ChatSessionRow,
} from "@/lib/db/chat";

/** Web Crypto — works on Cloudflare Workers (no Node `crypto` import). */
function randomGuestKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resume chat only via httpOnly cookie — never trust a client-supplied sessionId alone (IDOR).
 */
export async function resolveChatSession(opts: {
  userId?: string | null;
  cookieSessionId?: string | null;
}): Promise<{ session: ChatSessionRow; setCookie: boolean }> {
  const cookieId = opts.cookieSessionId?.trim() || null;

  if (cookieId) {
    const existing = await findChatSessionById(cookieId);
    if (existing) {
      if (existing.userId) {
        if (opts.userId && existing.userId === opts.userId) {
          return { session: existing, setCookie: false as const };
        }
        // Cookie points at another user's session — do not reuse
      } else {
        if (opts.userId) {
          return {
            session: await attachUserToChatSession(existing.id, opts.userId),
            setCookie: false as const,
          };
        }
        return { session: existing, setCookie: false as const };
      }
    }
  }

  const created = await createChatSession({
    userId: opts.userId || null,
    guestKey: randomGuestKey(),
  });

  return { session: created, setCookie: true as const };
}

export async function nextTicketNumber() {
  const n = await countSupportTickets();
  const seq = String(n + 1).padStart(5, "0");
  return `TKT-${seq}`;
}

export const CHAT_SESSION_COOKIE = "alpainoo_chat_session";
