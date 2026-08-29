import { randomUUID } from "crypto";

type UploadEnv = {
  UPLOADS?: R2Bucket;
};

export function getUploadsBucket(): R2Bucket | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
      getCloudflareContext: () => { env: UploadEnv };
    };
    return getCloudflareContext().env?.UPLOADS || null;
  } catch {
    return null;
  }
}

export async function storeProductImage(
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<string> {
  const filename = `${randomUUID()}.${ext}`;
  const key = `products/${filename}`;
  const bucket = getUploadsBucket();

  if (bucket) {
    await bucket.put(key, buffer, {
      httpMetadata: { contentType },
    });
    return `/api/uploads/${key}`;
  }

  // Local / Node fallback: write under public/
  const { mkdir, writeFile } = await import("fs/promises");
  const path = await import("path");
  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/products/${filename}`;
}
