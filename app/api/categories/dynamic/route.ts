import { NextResponse } from "next/server";
import { getDynamicCategories, getCategoryPatterns } from "@/core/services/categoryLearningService";

export async function GET() {
  try {
    const categories = getDynamicCategories();
    const patterns = getCategoryPatterns();
    
    return NextResponse.json({
      categories,
      patterns,
      totalCategories: categories.length,
      totalPatterns: patterns.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

