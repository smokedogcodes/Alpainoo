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

  try {
    const image = await getStoredImage(id);
    if (!image) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Pass bytes as BodyInit (Workers accepts Uint8Array at runtime).
    return new NextResponse(image.bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(image.bytes.byteLength),
      },
    });
  } catch (err) {
    console.error("[api/media] failed:", err);
    return NextResponse.json({ error: "Media error" }, { status: 500 });
  }
}
