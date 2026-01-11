import { NextRequest, NextResponse } from 'next/server';
import { getMainOrchestrator } from '@/core/agents/agentManager';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const orchestrator = getMainOrchestrator();
    const portfolioAgent = orchestrator.getPortfolioAgent();
    const loanAgent = orchestrator.getLoanAgent();

    // Try to load tokens from cookies if agents are not authenticated
    const loadTokens = async (agent: typeof portfolioAgent) => {
      if (!agent.isGmailAuthenticated()) {
        try {
          const cookieStore = await cookies();
          const cookieAccessToken = cookieStore.get('gmail_access_token');
          const cookieRefreshToken = cookieStore.get('gmail_refresh_token');
          
          if (cookieAccessToken && cookieRefreshToken) {
            agent.setTokens(cookieAccessToken.value, cookieRefreshToken.value);
            console.log('[Email Process API] Loaded tokens from cookies');
          }
        } catch (cookieError) {
          console.error('[Email Process API] Error loading tokens from cookies:', cookieError);
        }
      }

      // Also try loading from environment variables if still not authenticated
      if (!agent.isGmailAuthenticated()) {
        const envAccessToken = process.env.GMAIL_ACCESS_TOKEN;
        const envRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
        
        if (envAccessToken && envRefreshToken) {
          agent.setTokens(envAccessToken, envRefreshToken);
          console.log('[Email Process API] Loaded tokens from environment variables');
        }
      }
    };

    // Load tokens for both agents
    await loadTokens(portfolioAgent);
    await loadTokens(loanAgent);

    // Manually trigger email processing for both agents
    const [portfolioResult, loanResult] = await Promise.all([
      portfolioAgent.processEmailsManually().catch((error) => {
        console.error('[Email Process API] Portfolio agent error:', error);
        return { processedCount: 0, investmentCount: 0, errors: [error.message] };
      }),
      loanAgent.processLoanEmailsManually().catch((error) => {
        console.error('[Email Process API] Loan agent error:', error);
        return { processedCount: 0, quarterlyCount: 0, rateChangeCount: 0, errors: [error.message] };
      }),
    ]);

    return NextResponse.json({
      success: true,
      result: {
        portfolio: portfolioResult,
        loan: loanResult,
      },
      message: 'Email processing triggered for all agents',
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
    const loanAgent = orchestrator.getLoanAgent();

    // Get agent statuses
    const portfolioStatus = portfolioAgent.getStatus();
    const loanStatus = loanAgent.getStatus();
    const portfolioAuthenticated = portfolioAgent.isGmailAuthenticated();
    const loanAuthenticated = loanAgent.isGmailAuthenticated();

    return NextResponse.json({
      success: true,
      status: {
        portfolio: {
          ...portfolioStatus,
          isGmailAuthenticated: portfolioAuthenticated,
        },
        loan: {
          ...loanStatus,
          isGmailAuthenticated: loanAuthenticated,
        },
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

