import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { getBudget } from "@/server/finance/budget/service";

export const dynamic = "force-dynamic";

/** GET /api/budget?month=yyyy-mm → { items, entries } */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await getBudget(session.userId, request.nextUrl.searchParams.get("month")));
  } catch (error) {
    return errorResponse(error, "Failed to load budget");
  }
}
