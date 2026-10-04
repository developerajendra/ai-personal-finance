import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { createBudgetItem } from "@/server/finance/budget/service";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await createBudgetItem(session.userId, await request.json()), { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create budget item");
  }
}
