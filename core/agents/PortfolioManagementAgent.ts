import { BaseAgent, AgentMessage } from './base/BaseAgent';
import { fetchEmails, markEmailAsRead, archiveEmail, GmailEmail } from '@/core/services/gmailService';
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

  constructor() {
    super({
      name: 'portfolio-management',
      enabled: process.env.PORTFOLIO_AGENT_ENABLED !== 'false',
      analysisInterval: parseInt(
        process.env.PORTFOLIO_AGENT_INTERVAL || '300000',
        10
      ), // 5 minutes default
    });
    this.loadProcessedEmails();
    this.loadTokens();
  }

  /**
   * Set Gmail authentication tokens
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.isAuthenticated = true;
    this.saveTokens();
    console.log('[Portfolio Agent] Gmail tokens set');
  }

  /**
   * Clear authentication tokens
   */
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.isAuthenticated = false;
    this.saveTokens();
    console.log('[Portfolio Agent] Gmail tokens cleared');
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
              
              // Mark email as read and archive
              await markEmailAsRead(this.accessToken!, this.refreshToken!, email.id);
              await archiveEmail(this.accessToken!, this.refreshToken!, email.id);

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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to storage directly using jsonStorageService
      const { initializeStorage, loadFromJson, saveToJson } = await import('@/core/services/jsonStorageService');
      const { investments } = await import('@/core/dataStore');
      
      initializeStorage();
      const currentInvestments = loadFromJson<Investment>('investments');
      currentInvestments.push(investment);
      saveToJson('investments', currentInvestments);
      
      // Also update in-memory store
      investments.push(investment);
      
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
   * Load tokens from file
   */
  private loadTokens(): void {
    try {
      const tokensFile = path.join(process.cwd(), 'data', 'gmail-tokens.json');
      if (fs.existsSync(tokensFile)) {
        const data = fs.readFileSync(tokensFile, 'utf-8');
        const tokens = JSON.parse(data);
        this.accessToken = tokens.accessToken || null;
        this.refreshToken = tokens.refreshToken || null;
        this.isAuthenticated = !!(this.accessToken && this.refreshToken);
      }
    } catch (error) {
      console.error('[Portfolio Agent] Error loading tokens:', error);
    }
  }

  /**
   * Save tokens to file
   */
  private saveTokens(): void {
    try {
      const tokensFile = path.join(process.cwd(), 'data', 'gmail-tokens.json');
      const tokens = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2), 'utf-8');
    } catch (error) {
      console.error('[Portfolio Agent] Error saving tokens:', error);
    }
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
    if (!this.isGmailAuthenticated()) {
      throw new Error('Gmail not authenticated');
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
              
              // Mark email as read and archive
              await markEmailAsRead(this.accessToken!, this.refreshToken!, email.id);
              await archiveEmail(this.accessToken!, this.refreshToken!, email.id);

              console.log(
                `[Portfolio Agent] ✅ Created investment "${investment.name}" from email ${email.id}`
              );
            } else {
              errors.push(`Failed to create investment from email ${email.id}`);
            }
          } else {
            // Not an investment email, mark as processed to avoid re-checking
            this.markEmailAsProcessed(email.id);
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

