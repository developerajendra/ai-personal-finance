import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { updateInvestment, deleteInvestment } from "@/server/finance/investments/service";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const updated = await updateInvestment(session.userId, params.id, await request.json());
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error, "Failed to update investment");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await deleteInvestment(session.userId, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete investment");
  }
}
