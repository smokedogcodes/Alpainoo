import { getCloudflareContext } from "@opennextjs/cloudflare";

type CloudflareEnv = {
  DB?: D1Database;
  UPLOADS?: R2Bucket;
};

/** Shared D1 / R2 accessors for Cloudflare Workers. */
export async function getCloudflareEnv(): Promise<CloudflareEnv | null> {
  try {
    const { env } = (await getCloudflareContext({
      async: true,
    })) as { env: CloudflareEnv };
    return env ?? null;
  } catch {
    return null;
  }
}

export async function getD1(): Promise<D1Database | null> {
  const env = await getCloudflareEnv();
  return env?.DB ?? null;
}

export async function getUploadsR2(): Promise<R2Bucket | null> {
  const env = await getCloudflareEnv();
  return env?.UPLOADS ?? null;
}

/** eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function asD1(db: D1Database): any {
  return db as any;
}

export function cuidLike(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `c${t}${r}`;
}

export function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "1";
}

export function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  return new Date(String(v));
}

export function sqlNow(): string {
  return new Date().toISOString();
}
