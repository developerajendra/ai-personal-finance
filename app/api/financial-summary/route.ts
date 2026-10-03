import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { getFinancialSummary } from "@/server/finance/transactions/service";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const params = request.nextUrl.searchParams;
    const summary = await getFinancialSummary(session.userId, {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    });
    return NextResponse.json(summary);
  } catch (error) {
    return errorResponse(error, "Failed to calculate financial summary");
  }
}
