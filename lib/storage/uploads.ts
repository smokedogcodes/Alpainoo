import { randomUUID } from "crypto";
import { cuidLike, getD1, getUploadsR2, asD1, sqlNow } from "@/lib/db/d1";

/** Server hard cap — client should compress to ≤500 KB first. */
export const STORED_IMAGE_MAX_BYTES = 600 * 1024;

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

  // Prefer D1 BLOB on Workers (and whenever D1 is available)
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

  // Local Node / Prisma fallback
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
  if (db) {
    const row = await asD1(db)
      .prepare(`SELECT mimeType, bytes FROM StoredImage WHERE id = ? LIMIT 1`)
      .bind(id)
      .first();
    if (!row) return null;
    const raw = row.bytes;
    let bytes: Uint8Array;
    if (raw instanceof ArrayBuffer) bytes = new Uint8Array(raw);
    else if (raw instanceof Uint8Array) bytes = raw;
    else if (Buffer.isBuffer(raw)) bytes = new Uint8Array(raw);
    else if (typeof raw === "string") {
      // unlikely; treat as binary latin1
      bytes = new Uint8Array(Buffer.from(raw, "binary"));
    } else return null;
    return { mimeType: String(row.mimeType), bytes };
  }

  try {
    const { getPrismaAsync } = await import("@/lib/prisma");
    const prisma = await getPrismaAsync();
    const row = await prisma.storedImage.findUnique({ where: { id } });
    if (!row) return null;
    return {
      mimeType: row.mimeType,
      bytes: new Uint8Array(row.bytes),
    };
  } catch {
    return null;
  }
}
