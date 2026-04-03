import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/core/auth/getSession';

export async function GET() {
  try {
    const session = await getSession();
    const userId = session?.userId;

    const envAccessToken = process.env.GMAIL_ACCESS_TOKEN;
    const envRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const hasEnvTokens = !!(envAccessToken && envRefreshToken);

    const cookieStore = await cookies();
    const cookieAccessToken = cookieStore.get('gmail_access_token');
    const cookieRefreshToken = cookieStore.get('gmail_refresh_token');
    const hasCookieTokens = !!(cookieAccessToken && cookieRefreshToken);

    let hasAgentTokens = false;
    try {
      if (userId) {
        const { getMainOrchestrator } = await import('@/core/agents/agentManager');
        const orchestrator = getMainOrchestrator(userId);
        const portfolioAgent = orchestrator.getPortfolioAgent();
        hasAgentTokens = portfolioAgent.isGmailAuthenticated();
      }
    } catch {
      // Agent might not be initialized
    }

    const hasTokens = hasEnvTokens || hasCookieTokens || hasAgentTokens;
    const isExpired = false;

    return NextResponse.json({
      isConnected: hasTokens,
      hasTokens,
      hasEnvTokens,
      hasCookieTokens,
      hasAgentTokens,
      isExpired,
      message: hasTokens
        ? isExpired
          ? 'Connected but token expired'
          : 'Connected'
        : 'Not connected',
    });
  } catch (error: any) {
    console.error('[Gmail Status] Error:', error);
    return NextResponse.json(
      { isConnected: false, error: error.message },
      { status: 500 }
    );
  }
}

