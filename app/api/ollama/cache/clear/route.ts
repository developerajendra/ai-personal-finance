import { NextRequest, NextResponse } from "next/server";
import {
  clearAllCache,
  clearExpiredCache,
  invalidateCache,
} from "@/core/services/ollamaCacheService";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all"; // "all" | "expired" | "specific
    const message = searchParams.get("message");
    const systemPrompt = searchParams.get("systemPrompt");

    let cleared = 0;

    if (type === "expired") {
      cleared = clearExpiredCache();
    } else if (type === "specific" && message) {
      const result = invalidateCache(
        message,
        systemPrompt || undefined
      );
      cleared = result ? 1 : 0;
    } else {
      // Clear all
      cleared = clearAllCache();
    }

    return NextResponse.json({
      success: true,
      message: `Cleared ${cleared} cache entry/entries`,
      cleared,
    });
  } catch (error: any) {
    console.error("Error clearing cache:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

