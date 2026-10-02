import { NextRequest, NextResponse } from "next/server";
import { getZerodhaLoginUrl } from "@/server/integrations/kite/zerodhaService";
import { getSession } from "@/server/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const userId = session?.userId;
    const loginUrl = await getZerodhaLoginUrl(userId);
    return NextResponse.json({ loginUrl });
  } catch (error: any) {
    console.error("Error generating login URL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate login URL" },
      { status: 500 }
    );
  }
}

