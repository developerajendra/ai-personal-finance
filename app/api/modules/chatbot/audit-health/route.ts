import { NextResponse } from "next/server";
import { checkMcpHealth } from "@/core/services/mcpAuditService";

export async function GET() {
  try {
    const health = await checkMcpHealth();
    return NextResponse.json(health);
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, tools: [], error: error.message || "Health check failed" },
      { status: 500 }
    );
  }
}
