import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Delete cookies
    const cookieStore = await cookies();
    cookieStore.delete('gmail_access_token');
    cookieStore.delete('gmail_refresh_token');

    // Clear tokens from portfolio agent's memory
    try {
      const { getMainOrchestrator } = await import('@/core/agents/agentManager');
      const orchestrator = getMainOrchestrator();
      const portfolioAgent = orchestrator.getPortfolioAgent();
      portfolioAgent.clearTokens();
    } catch (error) {
      console.error('[Gmail Disconnect] Error clearing agent tokens:', error);
      // Non-critical
    }

    // Note: Environment variables should be cleared manually if needed

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

