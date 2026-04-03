import { NextRequest, NextResponse } from 'next/server';
import { getMainOrchestrator } from '@/core/agents/agentManager';
import { cookies } from 'next/headers';
import { getSession } from "@/core/auth/getSession";
import { fetchEmails } from '@/core/services/gmailService';
import { detectLoanEmail, extractInterestRateChange } from '@/core/services/loanEmailParserService';
import { GmailEmail } from '@/core/services/gmailService';
import { getEnabledPatterns } from '@/core/services/loanEmailPatternService';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.userId;

    const orchestrator = getMainOrchestrator(userId);
    const loanAgent = orchestrator.getLoanAgent();

    // Try to load tokens from cookies
    if (!loanAgent.isGmailAuthenticated()) {
      try {
        const cookieStore = await cookies();
        const cookieAccessToken = cookieStore.get('gmail_access_token');
        const cookieRefreshToken = cookieStore.get('gmail_refresh_token');
        
        if (cookieAccessToken && cookieRefreshToken) {
          loanAgent.setTokens(cookieAccessToken.value, cookieRefreshToken.value);
          console.log('[Fetch Rate Change] Loaded tokens from cookies');
        }
      } catch (cookieError) {
        console.error('[Fetch Rate Change] Error loading tokens from cookies:', cookieError);
      }
    }

    // Also try loading from environment variables
    if (!loanAgent.isGmailAuthenticated()) {
      const envAccessToken = process.env.GMAIL_ACCESS_TOKEN;
      const envRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
      
      if (envAccessToken && envRefreshToken) {
        loanAgent.setTokens(envAccessToken, envRefreshToken);
        console.log('[Fetch Rate Change] Loaded tokens from environment variables');
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

    // Get enabled interest rate change patterns
    const rateChangePatterns = getEnabledPatterns('interest-rate-change');
    
    if (rateChangePatterns.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No interest rate change email patterns configured. Please add patterns in Settings.',
      });
    }

    // Build Gmail query from patterns - use flexible matching
    // Extract key words from patterns for better matching
    const subjectQueries = rateChangePatterns.map(p => {
      // Use exact match first
      const exactMatch = `subject:"${p.title}"`;
      // Also extract key words for flexible matching
      const keywords = p.title.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3) // Filter out short words like "in", "of", "your"
        .map(word => `subject:${word}`)
        .join(' ');
      return `(${exactMatch} OR ${keywords})`;
    }).join(' OR ');
    
    // Add fallback search for rate change keywords
    const fallbackQuery = `(subject:"interest rate" OR subject:"rate change" OR subject:"rate reduced" OR subject:"rate increased" OR subject:"rate revised")`;
    const query = `(${subjectQueries} OR ${fallbackQuery})`;
    
    console.log('[Fetch Rate Change] Gmail query:', query);

    // Fetch latest email with interest rate change subject
    let { emails } = await fetchEmails(
      accessToken,
      refreshToken,
      {
        maxResults: 50,
        query,
      }
    );

    // If no emails found with pattern match, try broader search
    if (emails.length === 0) {
      console.log('[Fetch Rate Change] No emails found with pattern, trying broader search...');
      const broaderQuery = `(subject:"interest" AND subject:"rate" AND (subject:"change" OR subject:"update" OR subject:"reduced" OR subject:"increased" OR subject:"revised"))`;
      const broaderResult = await fetchEmails(
        accessToken,
        refreshToken,
        {
          maxResults: 50,
          query: broaderQuery,
        }
      );
      emails = broaderResult.emails;
    }

    if (emails.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No interest rate change emails found. Please check if the email subject matches the configured pattern.',
      });
    }

    // Get the latest email (first one, as they're sorted by date descending)
    const latestEmail = emails[0];
    
    console.log('[Fetch Rate Change] Found emails:', emails.length);
    console.log('[Fetch Rate Change] Latest email subject:', latestEmail.subject);
    console.log('[Fetch Rate Change] Latest email date:', latestEmail.date);

    // Detect if it's a loan email
    const detection = await detectLoanEmail(latestEmail);
    console.log('[Fetch Rate Change] Detection result:', detection);
    
    if (!detection.isLoanEmail) {
      return NextResponse.json({
        success: false,
        error: `Latest email is not detected as a loan email. Subject: "${latestEmail.subject}"`,
      });
    }
    
    if (detection.emailType !== 'interest-rate-change') {
      // Try to extract anyway if it's a loan email
      console.log('[Fetch Rate Change] Email type is', detection.emailType, 'but attempting extraction anyway');
    }

    // Extract rate change data (try even if detection type is not exact)
    const extractedData = await extractInterestRateChange(latestEmail);
    if (!extractedData) {
      return NextResponse.json({
        success: false,
        error: `Failed to extract interest rate change data from email. Subject: "${latestEmail.subject}". Please check if the email contains old rate, new rate, and account number.`,
      });
    }
    
    console.log('[Fetch Rate Change] Extracted data:', {
      accountNumber: extractedData.accountNumber,
      oldRate: extractedData.oldRate,
      newRate: extractedData.newRate,
      effectiveDate: extractedData.effectiveDate,
    });

    // Process the email through the loan agent
    const result = await loanAgent.processInterestRateChange(latestEmail);

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'Failed to process interest rate change email',
      });
    }

    return NextResponse.json({
      success: true,
      email: {
        id: latestEmail.id,
        subject: latestEmail.subject,
        date: latestEmail.date,
      },
      extractedData: {
        oldRate: extractedData.oldRate,
        newRate: extractedData.newRate,
        effectiveDate: extractedData.effectiveDate,
        accountNumber: extractedData.accountNumber,
        loanName: extractedData.loanName,
      },
      result: {
        loanId: result.loanId,
        updatedSnapshots: result.updatedSnapshots,
      },
      message: `Successfully updated interest rate from ${extractedData.oldRate}% to ${extractedData.newRate}% (effective ${extractedData.effectiveDate}). Updated ${result.updatedSnapshots} snapshot(s).`,
    });
  } catch (error: any) {
    console.error('[Fetch Rate Change] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch and process interest rate change email',
      },
      { status: 500 }
    );
  }
}
