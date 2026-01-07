import { NextRequest, NextResponse } from 'next/server';
import { getMainOrchestrator } from '@/core/agents/agentManager';

export async function POST(request: NextRequest) {
  try {
    const orchestrator = getMainOrchestrator();
    const portfolioAgent = orchestrator.getPortfolioAgent();

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

