import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback';

// Gmail API scopes
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export interface GmailEmail {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  htmlBody?: string;
}

/**
 * Create OAuth2 client
 */
export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI
  );
}

/**
 * Get Gmail OAuth authorization URL
 */
export function getGmailAuthUrl(): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to get tokens from Google');
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date || Date.now() + 3600 * 1000,
  };
}

/**
 * Get authenticated Gmail client
 */
export function getGmailClient(accessToken: string, refreshToken?: string): any {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Set up automatic token refresh
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      // Store new refresh token if provided
      console.log('[Gmail] Token refreshed');
    }
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expiry_date: number;
}> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  
  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }

  return {
    access_token: credentials.access_token,
    expiry_date: credentials.expiry_date || Date.now() + 3600 * 1000,
  };
}

/**
 * Fetch emails from Gmail
 */
export async function fetchEmails(
  accessToken: string,
  refreshToken: string,
  options: {
    maxResults?: number;
    query?: string;
    pageToken?: string;
  } = {}
): Promise<{ emails: GmailEmail[]; nextPageToken?: string }> {
  try {
    const gmail = getGmailClient(accessToken, refreshToken);
    const { maxResults = 10, query = 'is:unread', pageToken } = options;

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: query,
      pageToken,
    });

    const messages = response.data.messages || [];
    const emails: GmailEmail[] = [];

    // Fetch full message details
    for (const message of messages) {
      try {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full',
        });

        const email = parseGmailMessage(fullMessage.data);
        if (email) {
          emails.push(email);
        }
      } catch (error) {
        console.error(`[Gmail] Error fetching message ${message.id}:`, error);
      }
    }

    return {
      emails,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  } catch (error: any) {
    // Try to refresh token if expired
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      console.log('[Gmail] Token expired, refreshing...');
      const newTokens = await refreshAccessToken(refreshToken);
      // Retry with new token
      return fetchEmails(newTokens.access_token, refreshToken, options);
    }
    throw error;
  }
}

/**
 * Parse Gmail message format
 */
function parseGmailMessage(message: any): GmailEmail | null {
  try {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const to = getHeader('To');
    const date = getHeader('Date');

    // Extract body
    let body = '';
    let htmlBody = '';

    const extractBody = (part: any) => {
      if (part.body?.data) {
        const data = Buffer.from(part.body.data, 'base64').toString('utf-8');
        if (part.mimeType === 'text/html') {
          htmlBody += data;
        } else if (part.mimeType === 'text/plain') {
          body += data;
        }
      }

      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };

    if (message.payload) {
      extractBody(message.payload);
    }

    // Use plain text if HTML not available
    if (!body && htmlBody) {
      // Simple HTML to text conversion
      body = htmlBody.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    }

    return {
      id: message.id || '',
      threadId: message.threadId || '',
      snippet: message.snippet || '',
      subject,
      from,
      to,
      date,
      body: body.trim(),
      htmlBody: htmlBody || undefined,
    };
  } catch (error) {
    console.error('[Gmail] Error parsing message:', error);
    return null;
  }
}

/**
 * Mark email as read
 */
export async function markEmailAsRead(
  accessToken: string,
  refreshToken: string,
  emailId: string
): Promise<void> {
  try {
    const gmail = getGmailClient(accessToken, refreshToken);
    await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  } catch (error: any) {
    if (error.code === 401) {
      const newTokens = await refreshAccessToken(refreshToken);
      await markEmailAsRead(newTokens.access_token, refreshToken, emailId);
    } else {
      throw error;
    }
  }
}

/**
 * Archive email
 */
export async function archiveEmail(
  accessToken: string,
  refreshToken: string,
  emailId: string
): Promise<void> {
  try {
    const gmail = getGmailClient(accessToken, refreshToken);
    await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        removeLabelIds: ['INBOX'],
      },
    });
  } catch (error: any) {
    if (error.code === 401) {
      const newTokens = await refreshAccessToken(refreshToken);
      await archiveEmail(newTokens.access_token, refreshToken, emailId);
    } else {
      throw error;
    }
  }
}

