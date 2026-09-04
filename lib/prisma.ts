import { PrismaClient } from "@prisma/client";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type CloudflareEnv = {
  DB?: D1Database;
};

function looksLikeCloudflareWorker(): boolean {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.userAgent === "Cloudflare-Workers"
    ) {
      return true;
    }
    return (
      typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !==
      "undefined"
    );
  } catch {
    return false;
  }
}

function createNodePrisma(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./prisma-node").createNodePrisma() as PrismaClient;
}

/**
 * Local/Node Prisma only. On Cloudflare Workers, Prisma's engine exceeds the
 * free 3 MiB Worker limit (WASM) or hits `fs.readdir` (Node engine).
 * Shop reads use `lib/db/products.ts` (raw D1) instead.
 */
export function getPrisma(): PrismaClient {
  if (looksLikeCloudflareWorker()) {
    throw new Error(
      "Prisma is disabled on Cloudflare Workers (size/engine limits). Use lib/db D1 helpers."
    );
  }
  try {
    // If somehow D1 context exists outside Workers detection, still refuse.
    const { env } = getCloudflareContext() as { env: CloudflareEnv };
    if (env?.DB) {
      throw new Error(
        "Prisma is disabled on Cloudflare Workers. Use lib/db D1 helpers."
      );
    }
  } catch (err) {
    if (looksLikeCloudflareWorker()) throw err;
  }
  return createNodePrisma();
}

export async function getPrismaAsync(): Promise<PrismaClient> {
  if (looksLikeCloudflareWorker()) {
    throw new Error(
      "Prisma is disabled on Cloudflare Workers (size/engine limits). Use lib/db D1 helpers."
    );
  }
  return getPrisma();
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
