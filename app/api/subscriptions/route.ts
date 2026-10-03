import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { createSubscription, listSubscriptions } from "@/server/finance/subscriptions/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await listSubscriptions(session.userId));
  } catch (error) {
    return errorResponse(error, "Failed to load subscriptions");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await createSubscription(session.userId, await request.json()), { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create subscription");
  }
}
