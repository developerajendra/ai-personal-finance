import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback';

// Gmail API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

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
    } else if (error.message?.includes('insufficient authentication scopes') || error.message?.includes('insufficient authentication')) {
      console.error(`[Gmail] ❌ Insufficient authentication scopes for marking email as read.`);
      console.error(`[Gmail] Please re-authorize Gmail with modify permissions.`);
      throw new Error('Insufficient Gmail authentication scopes. Please re-authorize Gmail with modify permissions.');
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
    } else if (error.message?.includes('insufficient authentication scopes') || error.message?.includes('insufficient authentication')) {
      console.error(`[Gmail] ❌ Insufficient authentication scopes for archiving email.`);
      console.error(`[Gmail] Please re-authorize Gmail with modify permissions.`);
      throw new Error('Insufficient Gmail authentication scopes. Please re-authorize Gmail with modify permissions.');
    } else {
      throw error;
    }
  }
}

/**
 * Normalize label name for comparison (handles spaces, hyphens, case)
 */
function normalizeLabelName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, '-').trim();
}

/**
 * Get or create a Gmail label by name
 */
export async function getOrCreateLabel(
  accessToken: string,
  refreshToken: string,
  labelName: string
): Promise<string> {
  try {
    const gmail = getGmailClient(accessToken, refreshToken);
    
    // First, try to find existing label
    const labelsResponse = await gmail.users.labels.list({
      userId: 'me',
    });
    
    const normalizedSearchName = normalizeLabelName(labelName);
    console.log(`[Gmail] Looking for label matching: "${labelName}" (normalized: "${normalizedSearchName}")`);
    
    // Try exact match first
    let existingLabel = labelsResponse.data.labels?.find(
      (label: any) => label.name?.toLowerCase() === labelName.toLowerCase()
    );
    
    // If not found, try normalized match (handles spaces vs hyphens)
    if (!existingLabel) {
      existingLabel = labelsResponse.data.labels?.find(
        (label: any) => normalizeLabelName(label.name || '') === normalizedSearchName
      );
    }
    
    if (existingLabel?.id) {
      console.log(`[Gmail] Found existing label: "${existingLabel.name}" (ID: ${existingLabel.id})`);
      return existingLabel.id;
    }
    
    // Log all available labels for debugging
    const allLabels = labelsResponse.data.labels?.map((l: any) => l.name).filter(Boolean) || [];
    console.log(`[Gmail] Available labels: ${allLabels.join(', ')}`);
    console.log(`[Gmail] Label "${labelName}" not found, creating new label...`);
    
    // Create new label if it doesn't exist
    const createResponse = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });
    
    if (!createResponse.data.id) {
      throw new Error('Failed to create label');
    }
    
    console.log(`[Gmail] Created new label: "${labelName}" (ID: ${createResponse.data.id})`);
    return createResponse.data.id;
  } catch (error: any) {
    if (error.code === 401) {
      const newTokens = await refreshAccessToken(refreshToken);
      return getOrCreateLabel(newTokens.access_token, refreshToken, labelName);
    } else if (error.message?.includes('insufficient authentication scopes') || error.message?.includes('insufficient authentication')) {
      console.error(`[Gmail] ❌ Insufficient authentication scopes for creating/getting labels.`);
      console.error(`[Gmail] Please re-authorize Gmail with modify permissions.`);
      throw new Error('Insufficient Gmail authentication scopes. Please re-authorize Gmail with modify permissions.');
    }
    console.error(`[Gmail] Error in getOrCreateLabel:`, error);
    throw error;
  }
}

/**
 * Move email to a Gmail label/folder
 */
export async function moveEmailToLabel(
  accessToken: string,
  refreshToken: string,
  emailId: string,
  labelName: string
): Promise<void> {
  try {
    console.log(`[Gmail] Attempting to move email ${emailId} to label "${labelName}"`);
    const gmail = getGmailClient(accessToken, refreshToken);
    
    // Get or create the label
    const labelId = await getOrCreateLabel(accessToken, refreshToken, labelName);
    console.log(`[Gmail] Got label ID: ${labelId} for label "${labelName}"`);
    
    // Add the label to the email
    const modifyResponse = await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
    
    console.log(`[Gmail] ✅ Successfully moved email ${emailId} to label "${labelName}"`);
    console.log(`[Gmail] Email labels after move:`, modifyResponse.data.labelIds);
  } catch (error: any) {
    if (error.code === 401) {
      console.log(`[Gmail] Token expired, refreshing...`);
      const newTokens = await refreshAccessToken(refreshToken);
      await moveEmailToLabel(newTokens.access_token, refreshToken, emailId, labelName);
    } else if (error.message?.includes('insufficient authentication scopes') || error.message?.includes('insufficient authentication')) {
      console.error(`[Gmail] ❌ Insufficient authentication scopes. The Gmail token was granted with read-only permissions.`);
      console.error(`[Gmail] Please re-authorize Gmail with modify permissions by disconnecting and reconnecting in the admin panel.`);
      console.error(`[Gmail] Required scopes: gmail.readonly and gmail.modify`);
      throw new Error('Insufficient Gmail authentication scopes. Please re-authorize Gmail with modify permissions in the admin panel.');
    } else {
      console.error(`[Gmail] Error moving email ${emailId} to label "${labelName}":`, error);
      console.error(`[Gmail] Error details:`, {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });
      throw error;
    }
  }
}

