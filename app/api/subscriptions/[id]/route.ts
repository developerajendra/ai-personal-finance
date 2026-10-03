import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { deleteSubscription, updateSubscription } from "@/server/finance/subscriptions/service";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await updateSubscription(session.userId, params.id, await request.json()));
  } catch (error) {
    return errorResponse(error, "Failed to update subscription");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await deleteSubscription(session.userId, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete subscription");
  }
}
