import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { getLinkStatus, startLink, unlink } from "@/server/integrations/whatsapp/linking";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getLinkStatus(session.userId));
  } catch (error) {
    return errorResponse(error, "Failed to load WhatsApp link status");
  }
}

/** Start linking: returns a one-time code the user sends from WhatsApp as "LINK <code>". */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { phoneNumber } = await request.json();
    const { code, expiresAt, phoneNumber: normalized } = await startLink(session.userId, String(phoneNumber ?? ""));
    return NextResponse.json({
      status: "pending",
      phoneNumber: normalized,
      code,
      expiresAt,
      instructions: `From WhatsApp number +${normalized}, send "LINK ${code}" to the business number within 10 minutes.`,
    });
  } catch (error) {
    return errorResponse(error, "Failed to start WhatsApp linking");
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await unlink(session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to unlink WhatsApp");
  }
}
