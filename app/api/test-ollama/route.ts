import { NextResponse } from "next/server";
import { testOllamaConnection } from "@/core/services/ollamaService";

export async function GET() {
  try {
    console.log("🧪 Testing Ollama connection from API endpoint...");
    const result = await testOllamaConnection();
    
    return NextResponse.json({
      success: result.connected && result.modelAvailable,
      connected: result.connected,
      modelAvailable: result.modelAvailable,
      error: result.error,
      message: result.connected && result.modelAvailable
        ? "✅ Ollama connection successful!"
        : `❌ Connection failed: ${result.error || "Unknown error"}`,
    });
  } catch (error: any) {
    console.error("❌ Error testing Ollama connection:", error);
    return NextResponse.json(
      {
        success: false,
        connected: false,
        modelAvailable: false,
        error: error?.message || "Unknown error",
        message: `❌ Error: ${error?.message || "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}

