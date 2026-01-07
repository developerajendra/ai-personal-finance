import { NextRequest, NextResponse } from 'next/server';
import { getMainOrchestrator } from '@/core/agents/agentManager';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const orchestrator = getMainOrchestrator();
    const portfolioAgent = orchestrator.getPortfolioAgent();

    // Try to load tokens from cookies if agent is not authenticated
    if (!portfolioAgent.isGmailAuthenticated()) {
      try {
        const cookieStore = await cookies();
        const cookieAccessToken = cookieStore.get('gmail_access_token');
        const cookieRefreshToken = cookieStore.get('gmail_refresh_token');
        
        if (cookieAccessToken && cookieRefreshToken) {
          portfolioAgent.setTokens(cookieAccessToken.value, cookieRefreshToken.value);
          console.log('[Email Process API] Loaded tokens from cookies');
        }
      } catch (cookieError) {
        console.error('[Email Process API] Error loading tokens from cookies:', cookieError);
      }
    }

    // Also try loading from environment variables if still not authenticated
    if (!portfolioAgent.isGmailAuthenticated()) {
      const envAccessToken = process.env.GMAIL_ACCESS_TOKEN;
      const envRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
      
      if (envAccessToken && envRefreshToken) {
        portfolioAgent.setTokens(envAccessToken, envRefreshToken);
        console.log('[Email Process API] Loaded tokens from environment variables');
      }
    }

    // Manually trigger email processing
    const result = await portfolioAgent.processEmailsManually();

    return NextResponse.json({
      success: true,
      result,
      message: 'Email processing triggered',
    });
  } catch (error: any) {
    console.error('[Email Process API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process emails',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const orchestrator = getMainOrchestrator();
    const portfolioAgent = orchestrator.getPortfolioAgent();

    // Get agent status
    const status = portfolioAgent.getStatus();
    const isAuthenticated = portfolioAgent.isGmailAuthenticated();

    return NextResponse.json({
      success: true,
      status: {
        ...status,
        isGmailAuthenticated: isAuthenticated,
      },
    });
  } catch (error: any) {
    console.error('[Email Process API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get agent status',
      },
      { status: 500 }
    );
  }
}

