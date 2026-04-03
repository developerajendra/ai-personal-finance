import { BaseAgent, AgentMessage } from './base/BaseAgent';
import { fetchEmails, markEmailAsRead, archiveEmail, moveEmailToLabel, GmailEmail } from '@/core/services/gmailService';
import { analyzeEmail, ExtractedInvestment } from '@/core/services/emailParserService';
import { Investment } from '@/core/types';
import * as fs from 'fs';
import * as path from 'path';

const PROCESSED_EMAILS_FILE = path.join(process.cwd(), 'data', 'processed-emails.json');

interface ProcessedEmail {
  emailId: string;
  processedAt: number;
  investmentId?: string;
}

export class PortfolioManagementAgent extends BaseAgent {
  private processedEmails: Set<string> = new Set();
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isAuthenticated: boolean = false;
  private userId: string;

  constructor(userId: string) {
    super({
      name: 'portfolio-management',
      enabled: process.env.PORTFOLIO_AGENT_ENABLED !== 'false',
      analysisInterval: parseInt(
        process.env.PORTFOLIO_AGENT_INTERVAL || '300000',
        10
      ), // 5 minutes default
    });
    this.userId = userId;
    this.loadProcessedEmails();
    this.loadTokens();
  }

  /**
   * Set Gmail authentication tokens
   * Tokens are stored in memory and cookies, not in files
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.isAuthenticated = true;
    // Note: Tokens are stored in memory and cookies only
    // Environment variables should be updated manually if persistence is needed
    console.log('[Portfolio Agent] Gmail tokens set (stored in memory)');
  }

  /**
   * Clear authentication tokens
   */
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.isAuthenticated = false;
    // Note: In-memory tokens cleared. Cookies should be cleared separately via API
    console.log('[Portfolio Agent] Gmail tokens cleared from memory');
  }

  /**
   * Check if agent is authenticated
   */
  isGmailAuthenticated(): boolean {
    return this.isAuthenticated && !!this.accessToken && !!this.refreshToken;
  }

  protected async onStart(): Promise<void> {
    this.loadProcessedEmails();
    this.loadTokens();
    
    // Also try to load tokens from file if not set
    if (!this.isGmailAuthenticated()) {
      this.loadTokens(); // Try loading again
    }
    
    if (!this.isGmailAuthenticated()) {
      console.log('[Portfolio Agent] Gmail not authenticated. Waiting for connection...');
    } else {
      console.log('[Portfolio Agent] Gmail authenticated. Starting email monitoring...');
    }
  }

  protected async onStop(): Promise<void> {
    this.saveProcessedEmails();
    console.log('[Portfolio Agent] Stopped email monitoring');
  }

  protected async analyze(): Promise<void> {
    if (!this.isGmailAuthenticated()) {
      // Skip analysis if not authenticated
      return;
    }

    console.log('[Portfolio Agent] Starting email analysis cycle...');

    try {
      // Fetch unread emails (or all recent emails if manual processing)
      const { emails } = await fetchEmails(
        this.accessToken!,
        this.refreshToken!,
        {
          maxResults: 20,
          query: 'is:unread', // Only unread emails in automatic mode
        }
      );

      if (emails.length === 0) {
        console.log('[Portfolio Agent] No new emails to process');
        return;
      }

      console.log(`[Portfolio Agent] Found ${emails.length} unread emails`);

      let processedCount = 0;
      let investmentCount = 0;
      const errors: string[] = [];

      // Process each email
      for (const email of emails) {
        // Skip if already processed
        if (this.processedEmails.has(email.id)) {
          console.log(`[Portfolio Agent] Email ${email.id} already processed, skipping`);
          continue;
        }

        try {
          // Analyze email
          const analysis = await analyzeEmail(email);

          if (analysis.isInvestmentEmail && analysis.extractedData) {
            // Create investment
            const investment = await this.createInvestmentFromEmail(
              email,
              analysis.extractedData
            );

            if (investment) {
              investmentCount++;
              this.markEmailAsProcessed(email.id, investment.id);
              
              // Mark email as read, move to personal-finance label, and archive
              try {
                await markEmailAsRead(this.accessToken!, this.refreshToken!, email.id);
              } catch (error: any) {
                console.error(`[Portfolio Agent] Error marking email as read:`, error.message);
                // Continue even if marking as read fails
              }
              try {
                await moveEmailToLabel(this.accessToken!, this.refreshToken!, email.id, 'personal-finance');
                console.log(`[Portfolio Agent] Moved email ${email.id} to personal-finance label`);
              } catch (error: any) {
                console.error(`[Portfolio Agent] Error moving email to personal-finance label:`, error.message);
                // Continue even if label move fails
              }
              try {
                await archiveEmail(this.accessToken!, this.refreshToken!, email.id);
              } catch (error: any) {
                console.error(`[Portfolio Agent] Error archiving email:`, error.message);
                // Continue even if archiving fails
              }

              console.log(
                `[Portfolio Agent] ✅ Created investment "${investment.name}" from email ${email.id}`
              );

              // Send report to main agent
              this.sendMessage({
                type: 'report',
                data: {
                  reportType: 'investment-created',
                  emailId: email.id,
                  emailSubject: email.subject,
                  investment,
                  confidence: analysis.confidence,
                  timestamp: Date.now(),
                },
                priority: 'medium',
              });
            } else {
              errors.push(`Failed to create investment from email ${email.id}`);
            }
          } else {
            // Not an investment email, mark as processed to avoid re-checking
            this.markEmailAsProcessed(email.id);
            
            // Mark email as read, move to personal-finance label, and archive
            try {
              await markEmailAsRead(this.accessToken!, this.refreshToken!, email.id);
            } catch (error: any) {
              console.error(`[Portfolio Agent] Error marking email as read:`, error.message);
              // Continue even if marking as read fails
            }
            try {
              await moveEmailToLabel(this.accessToken!, this.refreshToken!, email.id, 'personal-finance');
              console.log(`[Portfolio Agent] Moved email ${email.id} to personal-finance label`);
            } catch (error: any) {
              console.error(`[Portfolio Agent] Error moving email to personal-finance label:`, error.message);
              // Continue even if label move fails
            }
            try {
              await archiveEmail(this.accessToken!, this.refreshToken!, email.id);
            } catch (error: any) {
              console.error(`[Portfolio Agent] Error archiving email:`, error.message);
              // Continue even if archiving fails
            }
            
            console.log(
              `[Portfolio Agent] Email ${email.id} is not an investment email (confidence: ${analysis.confidence})`
            );
          }

          processedCount++;
        } catch (error: any) {
          console.error(`[Portfolio Agent] Error processing email ${email.id}:`, error);
          errors.push(`Email ${email.id}: ${error.message}`);
        }
      }

      // Send summary report
      if (processedCount > 0) {
        this.sendMessage({
          type: 'report',
          data: {
            reportType: 'email-processing-summary',
            processedCount,
            investmentCount,
            errors: errors.length > 0 ? errors : undefined,
            timestamp: Date.now(),
          },
          priority: 'low',
        });
      }

      console.log(
        `[Portfolio Agent] Analysis complete. Processed: ${processedCount}, Investments created: ${investmentCount}`
      );
    } catch (error: any) {
      console.error('[Portfolio Agent] Analysis error:', error);
      this.sendMessage({
        type: 'alert',
        data: {
          alertType: 'error',
          message: `Email analysis failed: ${error.message}`,
          timestamp: Date.now(),
        },
        priority: 'high',
      });
    }
  }

  /**
   * Create investment from extracted email data
   */
  private async createInvestmentFromEmail(
    email: GmailEmail,
    extractedData: ExtractedInvestment
  ): Promise<Investment | null> {
    try {
      const investment: Investment = {
        id: `inv-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: extractedData.name,
        amount: extractedData.amount,
        type: extractedData.type,
        startDate: extractedData.startDate || new Date().toISOString().split('T')[0],
        maturityDate: extractedData.maturityDate,
        interestRate: extractedData.interestRate,
        description: extractedData.description || `Created from email: ${email.subject}`,
        status: 'active',
        isPublished: false, // Always create as draft
        tags: ['added from gmail'], // Tag to identify Gmail-created investments
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { loadFromJson, saveToJson } = await import('@/core/services/jsonStorageService');

      const currentInvestments = loadFromJson<Investment>('investments', this.userId);
      currentInvestments.push(investment);
      saveToJson('investments', currentInvestments, this.userId);
      
      return investment;
    } catch (error: any) {
      console.error('[Portfolio Agent] Error creating investment:', error);
      return null;
    }
  }

  /**
   * Mark email as processed
   */
  private markEmailAsProcessed(emailId: string, investmentId?: string): void {
    this.processedEmails.add(emailId);
    this.saveProcessedEmails();
    
    // Also save to file for persistence
    try {
      const processed: ProcessedEmail[] = this.loadProcessedEmailsFromFile();
      processed.push({
        emailId,
        processedAt: Date.now(),
        investmentId,
      });
      fs.writeFileSync(
        PROCESSED_EMAILS_FILE,
        JSON.stringify(processed, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('[Portfolio Agent] Error saving processed emails:', error);
    }
  }

  /**
   * Load processed emails from memory
   */
  private loadProcessedEmails(): void {
    const processed = this.loadProcessedEmailsFromFile();
    this.processedEmails = new Set(processed.map(p => p.emailId));
    console.log(`[Portfolio Agent] Loaded ${this.processedEmails.size} processed emails`);
  }

  /**
   * Load processed emails from file
   */
  private loadProcessedEmailsFromFile(): ProcessedEmail[] {
    try {
      if (fs.existsSync(PROCESSED_EMAILS_FILE)) {
        const data = fs.readFileSync(PROCESSED_EMAILS_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[Portfolio Agent] Error loading processed emails:', error);
    }
    return [];
  }

  /**
   * Save processed emails to file
   */
  private saveProcessedEmails(): void {
    // Already saved in markEmailAsProcessed
  }

  /**
   * Load tokens from environment variables
   */
  private loadTokens(): void {
    try {
      // Read tokens from environment variables
      const accessToken = process.env.GMAIL_ACCESS_TOKEN;
      const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
      
      if (accessToken && refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.isAuthenticated = true;
        console.log('[Portfolio Agent] Gmail tokens loaded from environment variables');
      } else {
        console.log('[Portfolio Agent] Gmail tokens not found in environment variables');
      }
    } catch (error) {
      console.error('[Portfolio Agent] Error loading tokens:', error);
    }
  }

  /**
   * Save tokens (no-op since we use env vars and in-memory storage)
   * Tokens are stored in memory and cookies, not in files
   */
  private saveTokens(): void {
    // Tokens are stored in memory and cookies
    // Environment variables should be updated manually if needed
    // Runtime token updates are handled via setTokens() which stores in memory
  }

  protected onMessageSent(message: AgentMessage): void {
    console.log(`[Portfolio Agent] Sent ${message.type} message to ${message.to}`);
  }

  protected onMessageReceived(message: AgentMessage): void {
    console.log(`[Portfolio Agent] Received ${message.type} message from ${message.from}`);
    
    if (message.type === 'request') {
      // Handle requests from main agent
      if (message.data?.action === 'process-emails') {
        // Manually trigger email processing
        this.analyze();
      }
    }
  }

  /**
   * Manually process emails (for API endpoint)
   */
  async processEmailsManually(): Promise<{
    processedCount: number;
    investmentCount: number;
    errors?: string[];
  }> {
    // Try to reload tokens from environment variables if not authenticated
    if (!this.isGmailAuthenticated()) {
      this.loadTokens();
    }

    if (!this.isGmailAuthenticated()) {
      throw new Error('Gmail not authenticated. Please connect Gmail first.');
    }

    console.log('[Portfolio Agent] Manual email processing triggered...');

    try {
      // Fetch recent emails (including read ones for manual processing)
      const { emails } = await fetchEmails(
        this.accessToken!,
        this.refreshToken!,
        {
          maxResults: 20,
          query: 'in:inbox', // Get all inbox emails for manual processing
        }
      );

      if (emails.length === 0) {
        console.log('[Portfolio Agent] No emails found');
        return { processedCount: 0, investmentCount: 0 };
      }

      console.log(`[Portfolio Agent] Found ${emails.length} emails for manual processing`);

      let processedCount = 0;
      let investmentCount = 0;
      const errors: string[] = [];

      // Process each email
      for (const email of emails) {
        // Skip if already processed
        if (this.processedEmails.has(email.id)) {
          console.log(`[Portfolio Agent] Email ${email.id} already processed, skipping`);
          continue;
        }

        try {
          // Analyze email
          const analysis = await analyzeEmail(email);

          if (analysis.isInvestmentEmail && analysis.extractedData) {
            // Create investment
            const investment = await this.createInvestmentFromEmail(
              email,
              analysis.extractedData
            );

            if (investment) {
              investmentCount++;
              this.markEmailAsProcessed(email.id, investment.id);
              
              // Mark email as read, move to personal-finance label, and archive
              try {
                await markEmailAsRead(this.accessToken!, this.refreshToken!, email.id);
              } catch (error: any) {
                console.error(`[Portfolio Agent] Error marking email as read:`, error.message);
                // Continue even if marking as read fails
              }
              try {
                await moveEmailToLabel(this.accessToken!, this.refreshToken!, email.id, 'personal-finance');
                console.log(`[Portfolio Agent] Moved email ${email.id} to personal-finance label`);
              } catch (error: any) {
                console.error(`[Portfolio Agent] Error moving email to personal-finance label:`, error.message);
                // Continue even if label move fails
              }
              try {
                await archiveEmail(this.accessToken!, this.refreshToken!, email.id);
              } catch (error: any) {
                console.error(`[Portfolio Agent] Error archiving email:`, error.message);
                // Continue even if archiving fails
              }

              console.log(
                `[Portfolio Agent] ✅ Created investment "${investment.name}" from email ${email.id}`
              );
            } else {
              errors.push(`Failed to create investment from email ${email.id}`);
            }
          } else {
            // Not an investment email, mark as processed to avoid re-checking
            this.markEmailAsProcessed(email.id);
            
            // Mark email as read, move to personal-finance label, and archive
            try {
              await markEmailAsRead(this.accessToken!, this.refreshToken!, email.id);
            } catch (error: any) {
              console.error(`[Portfolio Agent] Error marking email as read:`, error.message);
              // Continue even if marking as read fails
            }
            try {
              await moveEmailToLabel(this.accessToken!, this.refreshToken!, email.id, 'personal-finance');
              console.log(`[Portfolio Agent] Moved email ${email.id} to personal-finance label`);
            } catch (error: any) {
              console.error(`[Portfolio Agent] Error moving email to personal-finance label:`, error.message);
              // Continue even if label move fails
            }
            try {
              await archiveEmail(this.accessToken!, this.refreshToken!, email.id);
            } catch (error: any) {
              console.error(`[Portfolio Agent] Error archiving email:`, error.message);
              // Continue even if archiving fails
            }
            
            console.log(
              `[Portfolio Agent] Email ${email.id} is not an investment email (confidence: ${analysis.confidence})`
            );
          }

          processedCount++;
        } catch (error: any) {
          console.error(`[Portfolio Agent] Error processing email ${email.id}:`, error);
          errors.push(`Email ${email.id}: ${error.message}`);
        }
      }

      console.log(
        `[Portfolio Agent] Manual processing complete. Processed: ${processedCount}, Investments created: ${investmentCount}`
      );

      return {
        processedCount,
        investmentCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error('[Portfolio Agent] Manual processing error:', error);
      throw error;
    }
  }
}

