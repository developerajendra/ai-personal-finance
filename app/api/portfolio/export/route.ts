import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { buildPortfolioWorkbook } from "@/server/imports/workbookExport";

export const dynamic = "force-dynamic";

/** GET: download every portfolio record as the Ledger workbook (re-importable from Imports). */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const buffer = await buildPortfolioWorkbook(session.userId);
    const name = `portfolio-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, "Failed to export portfolio");
  }
}
