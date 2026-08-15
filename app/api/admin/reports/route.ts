import { NextResponse } from "next/server";
import { generateReport, toCsv, type ReportType } from "@/lib/reports";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "sales") as ReportType;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format");

  const rows = await generateReport(
    type,
    from ? new Date(from) : undefined,
    to ? new Date(to) : undefined
  );

  if (format === "csv") {
    const csv = toCsv(rows as Record<string, unknown>[]);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}-report.csv"`,
      },
    });
  }

  return NextResponse.json({ rows });
}
