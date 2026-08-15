import { NextResponse } from "next/server";
import { generateReport, toCsv, type ReportType } from "@/lib/reports";
import { requireAdminApi } from "@/lib/auth/admin";

const ALLOWED: ReportType[] = ["users", "sales", "inventory", "orders", "products", "discounts"];

export async function GET(req: Request) {
  const admin = await requireAdminApi();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "sales") as ReportType;
  if (!ALLOWED.includes(type)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

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
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(
    { rows },
    { headers: { "Cache-Control": "no-store" } }
  );
}
