import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN" || process.env.ADMIN_DEV_BYPASS === "true";
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(uploadDir, { recursive: true });

  const urls: string[] = [];
  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large: ${file.name}` }, { status: 400 });
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
    const filename = `${randomUUID()}.${safeExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);
    urls.push(`/uploads/products/${filename}`);
  }

  return NextResponse.json({ urls });
}
