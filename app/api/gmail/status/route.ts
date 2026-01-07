import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Check for tokens in environment variables
    const envAccessToken = process.env.GMAIL_ACCESS_TOKEN;
    const envRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const hasEnvTokens = !!(envAccessToken && envRefreshToken);

    // Check for tokens in cookies
    const cookieStore = await cookies();
    const cookieAccessToken = cookieStore.get('gmail_access_token');
    const cookieRefreshToken = cookieStore.get('gmail_refresh_token');
    const hasCookieTokens = !!(cookieAccessToken && cookieRefreshToken);

    // Check agent's in-memory tokens
    let hasAgentTokens = false;
    try {
      const { getMainOrchestrator } = await import('@/core/agents/agentManager');
      const orchestrator = getMainOrchestrator();
      const portfolioAgent = orchestrator.getPortfolioAgent();
      hasAgentTokens = portfolioAgent.isGmailAuthenticated();
    } catch (error) {
      // Agent might not be initialized, ignore
    }

    const hasTokens = hasEnvTokens || hasCookieTokens || hasAgentTokens;
    let isExpired = false;

    // Check if token is expired (if we have expiry info)
    // Note: OAuth tokens typically expire after 1 hour, but we don't track expiry in env vars
    // The gmailService will handle token refresh automatically

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

