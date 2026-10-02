import { NextResponse } from 'next/server';
import { initializeAgents } from '@/server/integrations/gmail/agents/agentManager';
import { getSession } from "@/server/auth/session";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    await initializeAgents(userId);
    return NextResponse.json({
      success: true,
      message: 'Agents initialized successfully',
    });
  } catch (error: any) {
    console.error('[Agent Init] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to initialize agents',
      },
      { status: 500 }
    );
  }
}

