import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { deleteBudgetEntry } from "@/server/finance/budget/service";

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await deleteBudgetEntry(session.userId, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete budget entry");
  }
}
