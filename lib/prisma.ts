import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { cache } from "react";

type CloudflareEnv = {
  DB?: D1Database;
  UPLOADS?: R2Bucket;
};

function createNodeClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function tryD1Client(): PrismaClient | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@opennextjs/cloudflare") as {
      getCloudflareContext: (opts?: { async?: boolean }) => { env: CloudflareEnv };
    };
    const { env } = mod.getCloudflareContext();
    if (env?.DB) {
      // Adapter typings vary across @cloudflare/workers-types versions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter = new PrismaD1(env.DB as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new PrismaClient({ adapter } as any);
    }
  } catch {
    // Node / next-dev without Workers bindings
  }
  return null;
}

/** Per-request client (Workers D1 or Node SQLite file). */
export const getPrisma = cache((): PrismaClient => {
  return tryD1Client() || createNodeClient();
});

/**
 * Drop-in replacement for the old singleton.
 * Proxies every access to a request-scoped client so Workers never reuse connections.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
