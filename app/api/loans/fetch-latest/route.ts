import { NextRequest, NextResponse } from 'next/server';
import { getMainOrchestrator } from '@/core/agents/agentManager';
import { cookies } from 'next/headers';
import { fetchEmails } from '@/core/services/gmailService';
import { detectLoanEmail, extractQuarterlyLoanData } from '@/core/services/loanEmailParserService';
import { GmailEmail } from '@/core/services/gmailService';
import { getEnabledPatterns } from '@/core/services/loanEmailPatternService';

export async function POST(request: NextRequest) {
  try {
    const orchestrator = getMainOrchestrator();
    const loanAgent = orchestrator.getLoanAgent();

    // Try to load tokens from cookies
    if (!loanAgent.isGmailAuthenticated()) {
      try {
        const cookieStore = await cookies();
        const cookieAccessToken = cookieStore.get('gmail_access_token');
        const cookieRefreshToken = cookieStore.get('gmail_refresh_token');
        
        if (cookieAccessToken && cookieRefreshToken) {
          loanAgent.setTokens(cookieAccessToken.value, cookieRefreshToken.value);
          console.log('[Fetch Latest] Loaded tokens from cookies');
        }
      } catch (cookieError) {
        console.error('[Fetch Latest] Error loading tokens from cookies:', cookieError);
      }
    }

    // Also try loading from environment variables
    if (!loanAgent.isGmailAuthenticated()) {
      const envAccessToken = process.env.GMAIL_ACCESS_TOKEN;
      const envRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
      
      if (envAccessToken && envRefreshToken) {
        loanAgent.setTokens(envAccessToken, envRefreshToken);
        console.log('[Fetch Latest] Loaded tokens from environment variables');
      }
    }

    if (!loanAgent.isGmailAuthenticated()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Gmail not authenticated. Please connect Gmail first.',
        },
        { status: 401 }
      );
    }

    // Get tokens from cookies or environment
    let accessToken = process.env.GMAIL_ACCESS_TOKEN || '';
    let refreshToken = process.env.GMAIL_REFRESH_TOKEN || '';
    
    // Try to get from cookies
    try {
      const cookieStore = await cookies();
      const cookieAccessToken = cookieStore.get('gmail_access_token');
      const cookieRefreshToken = cookieStore.get('gmail_refresh_token');
      if (cookieAccessToken && cookieRefreshToken) {
        accessToken = cookieAccessToken.value;
        refreshToken = cookieRefreshToken.value;
      }
    } catch (error) {
      // Ignore cookie errors
    }

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Gmail not authenticated. Please connect Gmail first.',
        },
        { status: 401 }
      );
    }

    // Get enabled quarterly summary patterns
    const quarterlyPatterns = getEnabledPatterns('quarterly-summary');
    
    if (quarterlyPatterns.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No quarterly summary email patterns configured. Please add patterns in Settings.',
      });
    }

    // Build Gmail query from patterns
    // Gmail query: subject:"pattern1" OR subject:"pattern2"
    const subjectQueries = quarterlyPatterns.map(p => `subject:"${p.title}"`).join(' OR ');
    const query = `(${subjectQueries})`;

    // Fetch latest email with quarterly loan summary subject
    const { emails } = await fetchEmails(
      accessToken,
      refreshToken,
      {
        maxResults: 50,
        query,
      }
    );

    if (emails.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No quarterly loan summary emails found',
      });
    }

    // Get the latest email (first one, as they're sorted by date descending)
    const latestEmail = emails[0];

    // Detect if it's a loan email
    const detection = await detectLoanEmail(latestEmail);
    if (!detection.isLoanEmail || detection.emailType !== 'quarterly-summary') {
      return NextResponse.json({
        success: false,
        error: 'Latest email is not a quarterly loan summary',
      });
    }

    // Extract loan data
    const extractedData = await extractQuarterlyLoanData(latestEmail);
    if (!extractedData) {
      return NextResponse.json({
        success: false,
        error: 'Failed to extract loan data from email',
      });
    }

    // Process the email through the loan agent
    const result = await loanAgent['processQuarterlySummary'](latestEmail);

    return NextResponse.json({
      success: true,
      email: {
        id: latestEmail.id,
        subject: latestEmail.subject,
        date: latestEmail.date,
      },
      extractedData: {
        ...extractedData,
        // Include calculated outstanding amount for verification
        calculatedOutstanding: extractedData.outstandingAmount,
      },
      result,
      message: 'Latest quarterly loan summary processed successfully',
    });
  } catch (error: any) {
    console.error('[Fetch Latest] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch latest loan summary',
      },
      { status: 500 }
    );
  }
}
