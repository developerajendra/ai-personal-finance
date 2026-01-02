import { NextRequest, NextResponse } from "next/server";
import { provideFeedback } from "@/core/services/categoryLearningService";

export async function POST(request: NextRequest) {
  try {
    const { patternId, wasCorrect } = await request.json();
    
    if (!patternId || typeof wasCorrect !== "boolean") {
      return NextResponse.json(
        { error: "patternId and wasCorrect are required" },
        { status: 400 }
      );
    }
    
    provideFeedback(patternId, wasCorrect);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to provide feedback" },
      { status: 500 }
    );
  }
}

