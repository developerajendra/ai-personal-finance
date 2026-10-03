import { NextResponse } from "next/server";
import { getCacheStats } from "@/server/ai/providers/ollama/cache";

export async function GET() {
  try {
    const stats = getCacheStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("Error getting cache stats:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

