import type { PrismaClient } from "@prisma/client";

/** Stub swapped in during Cloudflare builds — native SQLite must not ship to Workers. */
export function createNodePrisma(): PrismaClient {
  throw new Error(
    "Node SQLite is unavailable in the Cloudflare Worker. Use the D1 `DB` binding."
  );
}
