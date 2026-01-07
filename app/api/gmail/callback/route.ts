import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/core/services/gmailService';
import * as fs from 'fs';
import * as path from 'path';
import { cookies } from 'next/headers';

const TOKENS_FILE = path.join(process.cwd(), 'data', 'gmail-tokens.json');

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

    // Save tokens to file
    try {
      const tokensData = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        updatedAt: new Date().toISOString(),
      };
      
      // Ensure data directory exists
      const dataDir = path.dirname(TOKENS_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokensData, null, 2), 'utf-8');
    } catch (error) {
      console.error('[Gmail Callback] Error saving tokens:', error);
    }

    // Also set in httpOnly cookie for security
    const cookieStore = await cookies();
    cookieStore.set('gmail_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Notify portfolio agent about new tokens (will be loaded on next check)
    try {
      const { getMainOrchestrator } = await import('@/core/agents/agentManager');
      const orchestrator = getMainOrchestrator();
      const portfolioAgent = orchestrator.getPortfolioAgent();
      portfolioAgent.setTokens(tokens.access_token, tokens.refresh_token);
    } catch (error) {
      console.error('[Gmail Callback] Error notifying agent:', error);
      // Non-critical, agent will load tokens from file
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

