import { NextRequest, NextResponse } from "next/server";
import { getZerodhaLoginUrl } from "@/core/services/zerodhaService";

export async function GET(request: NextRequest) {
  try {
    const loginUrl = getZerodhaLoginUrl();
    return NextResponse.json({ loginUrl });
  } catch (error: any) {
    console.error("Error generating login URL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate login URL" },
      { status: 500 }
    );
  }
}

