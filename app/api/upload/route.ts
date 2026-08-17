import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

const MAGIC: Array<{ mime: string; check: (b: Buffer) => boolean }> = [
  { mime: "image/jpeg", check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/gif", check: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  {
    mime: "image/webp",
    check: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

function detectMime(buffer: Buffer) {
  return MAGIC.find((m) => m.check(buffer))?.mime || null;
}

export async function POST(req: Request) {
  const limited = await rateLimit(`upload:${clientIp(req)}`, { limit: 20, windowMs: 60_000 });
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }
  if (files.length > 10) {
    return NextResponse.json({ error: "Too many files" }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(uploadDir, { recursive: true });

  const urls: string[] = [];
  try {
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: `File too large: ${file.name}` }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const detected = detectMime(buffer);
      if (!detected || !ALLOWED.has(detected)) {
        return NextResponse.json({ error: `Unsupported or spoofed type: ${file.name}` }, { status: 400 });
      }
      const ext =
        detected === "image/jpeg"
          ? "jpg"
          : detected === "image/png"
            ? "png"
            : detected === "image/webp"
              ? "webp"
              : "gif";
      const filename = `${randomUUID()}.${ext}`;
      await writeFile(path.join(uploadDir, filename), buffer);
      urls.push(`/uploads/products/${filename}`);
    }

    const { logSuccess } = await import("@/lib/logging/system-log");
    await logSuccess({
      category: "admin",
      action: "UPLOAD_SUCCESS",
      message: `Uploaded ${urls.length} file(s)`,
      actorUserId: admin.id,
      path: "/api/upload",
      method: "POST",
      meta: { count: urls.length },
    });

    return NextResponse.json({ urls });
  } catch (err) {
    const { logError } = await import("@/lib/logging/system-log");
    await logError({
      category: "api",
      action: "UPLOAD_FAILED",
      message: err instanceof Error ? err.message : "Upload failed",
      actorUserId: admin.id,
      path: "/api/upload",
      method: "POST",
    });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
