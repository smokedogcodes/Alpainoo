import { PrismaClient } from "@prisma/client";

/**
 * Local/Node Prisma client using the file SQLite engine.
 * Never imported into the Cloudflare Worker (see prisma-node.stub.ts + CF_DEPLOY alias).
 */
export function createNodePrisma(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}
