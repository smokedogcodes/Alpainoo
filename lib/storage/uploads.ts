import { randomUUID } from "crypto";
import { cuidLike, getD1, getUploadsR2, asD1, sqlNow } from "@/lib/db/d1";

/** Server hard cap — client should compress to ≤500 KB first. */
export const STORED_IMAGE_MAX_BYTES = 600 * 1024;

/** Coerce D1/Prisma/Node blob shapes into Uint8Array. */
function toBytes(raw: unknown): Uint8Array | null {
  if (raw == null) return null;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) {
    const view = raw as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) {
    return new Uint8Array(raw);
  }
  if (Array.isArray(raw)) {
    return new Uint8Array(raw as number[]);
  }
  if (typeof raw === "string") {
    try {
      if (typeof atob === "function" && !raw.includes("\0")) {
        const bin = atob(raw);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        if (out.byteLength > 0) return out;
      }
    } catch {
      /* fall through */
    }
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(raw, "binary"));
    }
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i) & 0xff;
    return out;
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return new Uint8Array(obj.data as number[]);
    if (typeof obj.length === "number" && obj.length >= 0) {
      try {
        return new Uint8Array(raw as ArrayLike<number>);
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export async function storeProductImage(
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<string> {
  if (buffer.byteLength > STORED_IMAGE_MAX_BYTES) {
    throw new Error(
      `Image too large (${Math.round(buffer.byteLength / 1024)} KB). Max ${STORED_IMAGE_MAX_BYTES / 1024} KB after compress.`
    );
  }

  const filename = `${randomUUID()}.${ext}`;
  const key = `products/${filename}`;
  const bucket = await getUploadsR2();

  if (bucket) {
    await bucket.put(key, buffer, {
      httpMetadata: { contentType },
    });
    return `/api/uploads/${key}`;
  }

  const db = await getD1();
  if (db) {
    const id = cuidLike();
    await asD1(db)
      .prepare(
        `INSERT INTO StoredImage (id, mimeType, bytes, byteSize, createdAt)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, contentType, buffer, buffer.byteLength, sqlNow())
      .run();
    return `/api/media/${id}`;
  }

  try {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const row = await prisma.storedImage.create({
      data: {
        mimeType: contentType,
        bytes: buffer,
        byteSize: buffer.byteLength,
      },
    });
    return `/api/media/${row.id}`;
  } catch {
    /* Prisma table missing or local-only fs */
  }

  const { mkdir, writeFile } = await import("fs/promises");
  const path = await import("path");
  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/products/${filename}`;
}

export async function getStoredImage(id: string): Promise<{
  mimeType: string;
  bytes: Uint8Array;
} | null> {
  if (!id || id.includes("..") || id.includes("/")) return null;

  const db = await getD1();
  if (!db) {
    console.warn("[media] getD1() returned null — cannot load", id);
  } else {
    try {
      // Prefer .all() — some D1/OpenNext paths mishandle BLOB on .first()
      const res = await asD1(db)
        .prepare(`SELECT mimeType, bytes, byteSize FROM StoredImage WHERE id = ? LIMIT 1`)
        .bind(id)
        .all();
      const row = (res?.results?.[0] || null) as Record<string, unknown> | null;
      if (!row) {
        console.warn("[media] StoredImage row missing:", id);
        return null;
      }
      const bytes = toBytes(row.bytes);
      if (!bytes || bytes.byteLength === 0) {
        const proto =
          row.bytes == null
            ? "null"
            : Array.isArray(row.bytes)
              ? `array(${(row.bytes as unknown[]).length})`
              : typeof row.bytes === "object"
                ? Object.prototype.toString.call(row.bytes)
                : typeof row.bytes;
        console.warn(
          "[media] could not decode bytes for",
          id,
          "shape=",
          proto,
          "byteSize=",
          row.byteSize
        );
        return null;
      }
      return { mimeType: String(row.mimeType || "application/octet-stream"), bytes };
    } catch (err) {
      console.error("[media] D1 read failed:", err);
      return null;
    }
  }

  try {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const row = await prisma.storedImage.findUnique({ where: { id } });
    if (!row) return null;
    const bytes = toBytes(row.bytes);
    if (!bytes) return null;
    return {
      mimeType: row.mimeType,
      bytes,
    };
  } catch {
    return null;
  }
}
