import { NextResponse } from "next/server";
import { getStoredImage } from "@/lib/storage/uploads";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const image = await getStoredImage(id);
  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(image.bytes), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(image.bytes.byteLength),
    },
  });
}
