import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/core/auth/getSession';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const cookieStore = await cookies();
    cookieStore.delete('gmail_access_token');
    cookieStore.delete('gmail_refresh_token');

    try {
      const { getMainOrchestrator } = await import('@/core/agents/agentManager');
      const orchestrator = getMainOrchestrator(userId);
      const portfolioAgent = orchestrator.getPortfolioAgent();
      portfolioAgent.clearTokens();
    } catch (error) {
      console.error('[Gmail Disconnect] Error clearing agent tokens:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Gmail disconnected successfully',
    });
  } catch (error: any) {
    console.error('[Gmail Disconnect] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect' },
      { status: 500 }
    );
  }
}

