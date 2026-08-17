import { prisma } from "@/lib/prisma";

export type LogLevel = "ERROR" | "WARN" | "SUCCESS" | "INFO";

export type SystemLogInput = {
  level: LogLevel;
  category: string;
  action: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  path?: string | null;
  method?: string | null;
  meta?: Record<string, unknown> | null;
};

const SECRET_KEYS = /password|secret|authorization|token|signature|cookie|apikey|api_key|refresh_token|id_token/i;

function sanitizeMeta(meta?: Record<string, unknown> | null): string {
  if (!meta) return "{}";
  try {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (SECRET_KEYS.test(k)) {
        clean[k] = "[redacted]";
        continue;
      }
      if (typeof v === "string" && v.length > 2000) {
        clean[k] = v.slice(0, 2000) + "…";
      } else {
        clean[k] = v;
      }
    }
    const raw = JSON.stringify(clean);
    return raw.length > 8000 ? raw.slice(0, 8000) + "…" : raw;
  } catch {
    return "{}";
  }
}

export async function writeSystemLog(input: SystemLogInput) {
  try {
    await prisma.systemLog.create({
      data: {
        level: input.level,
        category: input.category.slice(0, 64),
        action: input.action.slice(0, 80),
        message: input.message.slice(0, 2000),
        entityType: input.entityType?.slice(0, 64) || null,
        entityId: input.entityId?.slice(0, 64) || null,
        actorUserId: input.actorUserId?.slice(0, 64) || null,
        actorEmail: input.actorEmail?.slice(0, 254) || null,
        path: input.path?.slice(0, 500) || null,
        method: input.method?.slice(0, 16) || null,
        meta: sanitizeMeta(input.meta),
      },
    });
  } catch (err) {
    console.error("[system-log] write failed:", err);
  }
}

export function logError(input: Omit<SystemLogInput, "level">) {
  return writeSystemLog({ ...input, level: "ERROR" });
}

export function logSuccess(input: Omit<SystemLogInput, "level">) {
  return writeSystemLog({ ...input, level: "SUCCESS" });
}

export function logWarn(input: Omit<SystemLogInput, "level">) {
  return writeSystemLog({ ...input, level: "WARN" });
}

export function logInfo(input: Omit<SystemLogInput, "level">) {
  return writeSystemLog({ ...input, level: "INFO" });
}
