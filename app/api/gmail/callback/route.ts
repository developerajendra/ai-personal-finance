import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/core/services/gmailService';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/admin/portfolio?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/admin/portfolio?error=no_code', request.url)
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Set tokens in httpOnly cookies for security
    const cookieStore = await cookies();
    cookieStore.set('gmail_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    cookieStore.set('gmail_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Notify portfolio agent about new tokens (stored in memory)
    try {
      const { getMainOrchestrator } = await import('@/core/agents/agentManager');
      const orchestrator = getMainOrchestrator();
      const portfolioAgent = orchestrator.getPortfolioAgent();
      portfolioAgent.setTokens(tokens.access_token, tokens.refresh_token);
    } catch (error) {
      console.error('[Gmail Callback] Error notifying agent:', error);
      // Non-critical, agent will load tokens from env vars on restart
    }

    // Redirect to admin panel with success
    return NextResponse.redirect(
      new URL('/admin/portfolio?gmail_connected=true', request.url)
    );
  } catch (error: any) {
    console.error('[Gmail Callback] Error:', error);
    return NextResponse.redirect(
      new URL(
        `/admin/portfolio?error=${encodeURIComponent(error.message || 'Authentication failed')}`,
        request.url
      )
    );
  }
}

