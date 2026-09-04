import { NextResponse } from "next/server";
import { getUploadsR2 } from "@/lib/db/d1";

export async function GET(
  _req: Request,
  { params }: { params: { key: string[] } }
) {
  const key = (params.key || []).join("/");
  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bucket = await getUploadsR2();
  if (!bucket) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  const object = await bucket.get(key);
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new NextResponse(object.body, { headers });
}
