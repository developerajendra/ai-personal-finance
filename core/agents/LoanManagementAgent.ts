import { BaseAgent, AgentMessage } from './base/BaseAgent';
import { fetchEmails, markEmailAsRead, archiveEmail, moveEmailToLabel, GmailEmail } from '@/core/services/gmailService';
import {
  detectLoanEmail,
  extractQuarterlyLoanData,
  extractInterestRateChange,
  ExtractedQuarterlyLoanData,
  ExtractedRateChange,
} from '@/core/services/loanEmailParserService';
import { Loan, LoanMonthlySnapshot } from '@/core/types';
import {
  saveLoanMonthlySnapshot,
  getLoanSnapshot,
  getLoanSnapshots,
  generateMissingMonthlySnapshots,
  getPreviousLoanSnapshot,
} from '@/core/services/loanAnalyticsService';
import { recordEmailProcessing } from '@/core/services/loanEmailMetadataService';
import * as fs from 'fs';
import * as path from 'path';

const LOANS_DIR = path.join(process.cwd(), 'data', 'loans');
const PROCESSED_LOAN_EMAILS_FILE = path.join(LOANS_DIR, 'processed-loan-emails.json');
const OLD_PROCESSED_LOAN_EMAILS_FILE = path.join(process.cwd(), 'data', 'processed-loan-emails.json');

interface ProcessedLoanEmail {
  emailId: string;
  processedAt: number;
  loanId?: string;
  snapshotId?: string;
}

export class LoanManagementAgent extends BaseAgent {
  private processedEmails: Set<string> = new Set();
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isAuthenticated: boolean = false;
  private userId: string;

  constructor(userId: string) {
    super({
      name: 'loan-management',
      enabled: process.env.LOAN_AGENT_ENABLED !== 'false',
      analysisInterval: parseInt(
        process.env.LOAN_AGENT_INTERVAL || '300000',
        10
      ), // 5 minutes default
    });
    this.userId = userId;
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
    console.log('[Loan Agent] Gmail tokens set (stored in memory)');
  }

  /**
   * Clear authentication tokens
   */
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.isAuthenticated = false;
    console.log('[Loan Agent] Gmail tokens cleared from memory');
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

    if (!this.isGmailAuthenticated()) {
      console.log('[Loan Agent] Gmail not authenticated. Waiting for connection...');
    } else {
      console.log('[Loan Agent] Gmail authenticated. Starting email monitoring...');
    }
  }

  protected async onStop(): Promise<void> {
    this.saveProcessedEmails();
    console.log('[Loan Agent] Stopped email monitoring');
  }

  protected async analyze(): Promise<void> {
    if (!this.isGmailAuthenticated()) {
      return;
    }

    console.log('[Loan Agent] Starting email analysis cycle...');

    try {
      // Fetch unread emails
      const { emails } = await fetchEmails(
        this.accessToken!,
        this.refreshToken!,
        {
          maxResults: 20,
          query: 'is:unread',
        }
      );

      if (emails.length === 0) {
        console.log('[Loan Agent] No new emails to process');
        return;
      }

      console.log(`[Loan Agent] Found ${emails.length} unread emails`);

      let processedCount = 0;
      let quarterlyCount = 0;
      let rateChangeCount = 0;
      const errors: string[] = [];

      // Process each email
      for (const email of emails) {
        if (this.processedEmails.has(email.id)) {
          console.log(`[Loan Agent] Email ${email.id} already processed, skipping`);
          continue;
        }

        try {
          // Detect if it's a loan email
          const detection = await detectLoanEmail(email);

          if (!detection.isLoanEmail || detection.confidence < 0.3) {
            // Not a loan email, mark as processed to avoid re-checking
            this.markEmailAsProcessed(email.id);
            processedCount++;
            continue;
          }

          if (detection.emailType === 'quarterly-summary') {
            const result = await this.processQuarterlySummary(email);
            if (result) {
              quarterlyCount++;
              this.markEmailAsProcessed(email.id, result.loanId, result.snapshotId);
            }
          } else if (detection.emailType === 'interest-rate-change') {
            const result = await this.processInterestRateChange(email);
            if (result) {
              rateChangeCount++;
              this.markEmailAsProcessed(email.id, result.loanId);
            }
          }

          // Mark email as read, move to personal-finance label, and archive
          try {
            await markEmailAsRead(this.accessToken!, this.refreshToken!, email.id);
          } catch (error: any) {
            console.error(`[Loan Agent] Error marking email as read:`, error.message);
          }
          try {
            await moveEmailToLabel(this.accessToken!, this.refreshToken!, email.id, 'personal-finance');
            console.log(`[Loan Agent] Moved email ${email.id} to personal-finance label`);
          } catch (error: any) {
            console.error(`[Loan Agent] Error moving email to personal-finance label:`, error.message);
          }
          try {
            await archiveEmail(this.accessToken!, this.refreshToken!, email.id);
          } catch (error: any) {
            console.error(`[Loan Agent] Error archiving email:`, error.message);
          }

          processedCount++;
        } catch (error: any) {
          console.error(`[Loan Agent] Error processing email ${email.id}:`, error);
          errors.push(`Email ${email.id}: ${error.message}`);
        }
      }

      // Send summary report
      if (processedCount > 0) {
        this.sendMessage({
          type: 'report',
          data: {
            reportType: 'loan-email-processing-summary',
            processedCount,
            quarterlyCount,
            rateChangeCount,
            errors: errors.length > 0 ? errors : undefined,
            timestamp: Date.now(),
          },
          priority: 'low',
        });
      }

      console.log(
        `[Loan Agent] Analysis complete. Processed: ${processedCount}, Quarterly: ${quarterlyCount}, Rate Changes: ${rateChangeCount}`
      );
    } catch (error: any) {
      console.error('[Loan Agent] Analysis error:', error);
      this.sendMessage({
        type: 'alert',
        data: {
          alertType: 'error',
          message: `Loan email analysis failed: ${error.message}`,
          timestamp: Date.now(),
        },
        priority: 'high',
      });
    }
  }

  /**
   * Process quarterly loan summary email
   * Made public for API access
   */
  async processQuarterlySummary(
    email: GmailEmail
  ): Promise<{ loanId: string; snapshotId: string } | null> {
    try {
      // Get global reference data FIRST - AI will analyze this before processing email
      const { getGlobalReferenceData } = await import('@/core/services/loanReferenceDataService');
      const referenceData = getGlobalReferenceData();
      
      // Extract with reference data FIRST - AI analyzes reference data before email
      const extractedData = await extractQuarterlyLoanData(
        email,
        referenceData && Object.keys(referenceData.data).length > 0 ? referenceData.data : undefined
      );
      
      if (!extractedData) {
        console.error('[Loan Agent] Failed to extract quarterly loan data');
        return null;
      }

      if (referenceData && Object.keys(referenceData.data).length > 0) {
        console.log('[Loan Agent] Extracted data using reference data for calculations');
      }

      // Match to existing loan
      const loan = await this.matchLoanToEmail(extractedData);
      if (!loan) {
        console.error(`[Loan Agent] Could not match loan for account ${extractedData.accountNumber}`);
        return null;
      }

      // Parse quarter end date
      const quarterEndDate = new Date(extractedData.quarterEndDate);
      const year = quarterEndDate.getFullYear();
      const month = quarterEndDate.getMonth() + 1;

      // Email provides CUMULATIVE totals ("Principal amount recovered till date")
      // We should store CUMULATIVE values in snapshots, not quarterly amounts
      // This matches the UI label "Interest Paid till date" which implies cumulative
      
      // The extractedData.principalPaid and extractedData.interestPaid are already cumulative
      // from the email, so we use them directly
      const cumulativePrincipalPaid = extractedData.principalPaid;
      const cumulativeInterestPaid = extractedData.interestPaid;

      // CRITICAL: Recalculate outstanding amount using Disbursement Amount from reference data
      // This ensures correct calculation: Outstanding = Disbursement Amount - Cumulative Principal Paid
      let finalOutstandingAmount = extractedData.outstandingAmount;
      if (referenceData && Object.keys(referenceData.data).length > 0) {
        // Find Disbursement Amount in reference data (case-insensitive)
        const disbursementKeys = ['Disbursement Amount', 'DisbursementAmount', 'disbursement amount', 'disbursementAmount', 'Disbursement'];
        let disbursementAmount: number | null = null;
        
        for (const key of disbursementKeys) {
          let value = referenceData.data[key];
          if (value === undefined) {
            const lowerKey = key.toLowerCase();
            const foundKey = Object.keys(referenceData.data).find(k => k.toLowerCase() === lowerKey);
            if (foundKey) {
              value = referenceData.data[foundKey];
            }
          }
          
          if (value !== undefined && value !== null) {
            disbursementAmount = typeof value === 'number' 
              ? value 
              : parseFloat(String(value).replace(/[^0-9.]/g, ''));
            if (disbursementAmount > 0) {
              break;
            }
          }
        }
        
        if (disbursementAmount && disbursementAmount > 0) {
          // Outstanding = Disbursement Amount - Cumulative Principal Paid (from email)
          finalOutstandingAmount = disbursementAmount - extractedData.principalPaid;
          console.log(`[Loan Agent] ✅ Recalculated outstanding using Disbursement Amount: ${disbursementAmount.toLocaleString('en-IN')} - ${extractedData.principalPaid.toLocaleString('en-IN')} = ${finalOutstandingAmount.toLocaleString('en-IN')}`);
        } else {
          console.warn('[Loan Agent] ⚠️ Disbursement Amount not found in reference data, using extracted value');
        }
      }

      // Check if quarterly summary is 2 months old
      const now = new Date();
      const monthsDiff = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
      
      // Create snapshot for quarter end month
      // IMPORTANT: Only update/create snapshot for THIS specific quarter (year-month)
      // This ensures fetching a new quarter doesn't affect existing quarters
      const snapshot: LoanMonthlySnapshot = {
        id: `loan-snapshot-${loan.id}-${year}-${month}-${Date.now()}`,
        loanId: loan.id,
        year,
        month,
        outstandingAmount: finalOutstandingAmount, // Use recalculated value
        principalPaid: cumulativePrincipalPaid, // Cumulative amount (till date)
        interestPaid: cumulativeInterestPaid, // Cumulative amount (till date)
        emiAmount: extractedData.emiAmount,
        interestRate: extractedData.interestRate,
        remainingTenureMonths: extractedData.remainingTenureMonths,
        snapshotDate: new Date(year, month, 0).toISOString(), // Last day of month
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const savedSnapshot = saveLoanMonthlySnapshot(this.userId, snapshot);

      // Record email metadata
      recordEmailProcessing(
        loan.id,
        email.id,
        email.subject || 'Loan Summary Email',
        email.date || new Date().toISOString(),
        `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
      );

      // If quarterly summary is 2 months old, generate next 2 months
      if (monthsDiff >= 2) {
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        generateMissingMonthlySnapshots(this.userId, loan.id, savedSnapshot, currentYear, currentMonth);
      }

      const { loadFromJson, saveToJson } = await import('@/core/services/jsonStorageService');

      const currentLoans = loadFromJson<Loan>('loans', this.userId);
      const loanIndex = currentLoans.findIndex((l: Loan) => l.id === loan.id);

      if (loanIndex >= 0) {
        currentLoans[loanIndex].outstandingAmount = finalOutstandingAmount;
        currentLoans[loanIndex].interestRate = extractedData.interestRate;
        currentLoans[loanIndex].updatedAt = new Date().toISOString();
        saveToJson('loans', currentLoans, this.userId);
      }

      console.log(
        `[Loan Agent] ✅ Created quarterly snapshot for loan "${loan.name}" (${year}-${month})`
      );

      // Send report
      this.sendMessage({
        type: 'report',
        data: {
          reportType: 'quarterly-snapshot-created',
          emailId: email.id,
          emailSubject: email.subject,
          loanId: loan.id,
          snapshotId: savedSnapshot.id,
          year,
          month,
          reductionType: extractedData.reductionType,
          timestamp: Date.now(),
        },
        priority: 'medium',
      });

      return { loanId: loan.id, snapshotId: savedSnapshot.id };
    } catch (error: any) {
      console.error('[Loan Agent] Error processing quarterly summary:', error);
      return null;
    }
  }

  /**
   * Process interest rate change email
   * Made public for API access
   */
  async processInterestRateChange(
    email: GmailEmail
  ): Promise<{ loanId: string; updatedSnapshots: number } | null> {
    try {
      // Extract rate change data
      const extractedData = await extractInterestRateChange(email);
      if (!extractedData) {
        console.error('[Loan Agent] Failed to extract interest rate change data');
        return null;
      }

      // Match to existing loan
      const loan = await this.matchLoanToEmail(extractedData);
      if (!loan) {
        console.error(`[Loan Agent] Could not match loan for account ${extractedData.accountNumber}`);
        return null;
      }

      // Parse effective date
      const effectiveDate = new Date(extractedData.effectiveDate);
      // Set to start of day for accurate comparison
      effectiveDate.setHours(0, 0, 0, 0);
      const effectiveYear = effectiveDate.getFullYear();
      const effectiveMonth = effectiveDate.getMonth() + 1;

      console.log(`[Loan Agent] Processing interest rate change: ${extractedData.oldRate}% -> ${extractedData.newRate}% (effective ${extractedData.effectiveDate})`);

      const { loadFromJson, saveToJson } = await import('@/core/services/jsonStorageService');

      const currentLoans = loadFromJson<Loan>('loans', this.userId);
      const loanIndex = currentLoans.findIndex((l: Loan) => l.id === loan.id);

      if (loanIndex >= 0) {
        currentLoans[loanIndex].interestRate = extractedData.newRate;
        currentLoans[loanIndex].updatedAt = new Date().toISOString();
        saveToJson('loans', currentLoans, this.userId);
      }

      const allSnapshots = getLoanSnapshots(this.userId, loan.id);
      
      let updatedSnapshotsCount = 0;
      for (const snapshot of allSnapshots) {
        const snapshotDate = new Date(snapshot.year, snapshot.month, 0);
        snapshotDate.setHours(0, 0, 0, 0);
        
        if (snapshotDate >= effectiveDate) {
          const oldRate = snapshot.interestRate;
          snapshot.interestRate = extractedData.newRate;
          snapshot.updatedAt = new Date().toISOString();
          saveLoanMonthlySnapshot(this.userId, snapshot);
          updatedSnapshotsCount++;
          console.log(`[Loan Agent] Updated snapshot ${snapshot.year}-${snapshot.month}: ${oldRate}% -> ${extractedData.newRate}%`);
        }
      }

      if (updatedSnapshotsCount > 0) {
        console.log(`[Loan Agent] ✅ Updated ${updatedSnapshotsCount} snapshot(s) with new interest rate ${extractedData.newRate}%`);
      }

      console.log(
        `[Loan Agent] ✅ Updated interest rate for loan "${loan.name}" from ${extractedData.oldRate}% to ${extractedData.newRate}% (effective ${extractedData.effectiveDate})`
      );

      // Record email metadata (for Data Source Information display)
      recordEmailProcessing(
        loan.id,
        email.id,
        email.subject || 'Interest Rate Change Email',
        email.date || new Date().toISOString(),
        `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}-${String(new Date(effectiveYear, effectiveMonth, 0).getDate()).padStart(2, '0')}`
      );

      // Send report
      this.sendMessage({
        type: 'report',
        data: {
          reportType: 'interest-rate-updated',
          emailId: email.id,
          emailSubject: email.subject,
          loanId: loan.id,
          oldRate: extractedData.oldRate,
          newRate: extractedData.newRate,
          effectiveDate: extractedData.effectiveDate,
          updatedSnapshots: updatedSnapshotsCount,
          timestamp: Date.now(),
        },
        priority: 'medium',
      });

      return { loanId: loan.id, updatedSnapshots: updatedSnapshotsCount };
    } catch (error: any) {
      console.error('[Loan Agent] Error processing interest rate change:', error);
      return null;
    }
  }

  /**
   * Match extracted data to existing loan
   */
  private async matchLoanToEmail(
    extractedData: ExtractedQuarterlyLoanData | ExtractedRateChange
  ): Promise<Loan | null> {
    const { initializeStorage, loadFromJson } = await import('@/core/services/jsonStorageService');
    initializeStorage();
    const loans = loadFromJson<Loan>('loans', this.userId);

    // Try matching by account number (if stored in description or name)
    // Note: We don't store account numbers in Loan interface, so we'll match by name/type
    const accountNumber = extractedData.accountNumber.toLowerCase();

    // Try matching by loan name
    const nameMatch = loans.find(loan => {
      const loanName = loan.name.toLowerCase();
      const extractedName = extractedData.loanName.toLowerCase();
      return loanName.includes(extractedName) || extractedName.includes(loanName);
    });

    if (nameMatch) {
      return nameMatch;
    }

    // Try matching by loan type
    if ('loanType' in extractedData && extractedData.loanType) {
      const typeMatch = loans.find(loan => loan.type === extractedData.loanType);
      if (typeMatch) {
        return typeMatch;
      }
    }

    // If only one active loan exists, use it
    const activeLoans = loans.filter(loan => loan.status === 'active');
    if (activeLoans.length === 1) {
      return activeLoans[0];
    }

    return null;
  }

  /**
   * Mark email as processed
   */
  private markEmailAsProcessed(
    emailId: string,
    loanId?: string,
    snapshotId?: string
  ): void {
    this.processedEmails.add(emailId);
    this.saveProcessedEmails();

    try {
      const processed: ProcessedLoanEmail[] = this.loadProcessedEmailsFromFile();
      processed.push({
        emailId,
        processedAt: Date.now(),
        loanId,
        snapshotId,
      });
      fs.writeFileSync(
        PROCESSED_LOAN_EMAILS_FILE,
        JSON.stringify(processed, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('[Loan Agent] Error saving processed emails:', error);
    }
  }

  /**
   * Load processed emails from memory
   */
  private loadProcessedEmails(): void {
    const processed = this.loadProcessedEmailsFromFile();
    this.processedEmails = new Set(processed.map(p => p.emailId));
    console.log(`[Loan Agent] Loaded ${this.processedEmails.size} processed emails`);
  }

  /**
   * Load processed emails from file
   */
  private loadProcessedEmailsFromFile(): ProcessedLoanEmail[] {
    try {
      // Ensure loans directory exists
      if (!fs.existsSync(LOANS_DIR)) {
        fs.mkdirSync(LOANS_DIR, { recursive: true });
      }
      
      // Migrate old file if it exists
      if (fs.existsSync(OLD_PROCESSED_LOAN_EMAILS_FILE) && !fs.existsSync(PROCESSED_LOAN_EMAILS_FILE)) {
        try {
          fs.copyFileSync(OLD_PROCESSED_LOAN_EMAILS_FILE, PROCESSED_LOAN_EMAILS_FILE);
          console.log('[Loan Agent] Migrated processed-loan-emails.json to data/loans/');
        } catch (error) {
          console.error('[Loan Agent] Error migrating processed-loan-emails.json:', error);
        }
      }
      
      if (fs.existsSync(PROCESSED_LOAN_EMAILS_FILE)) {
        const data = fs.readFileSync(PROCESSED_LOAN_EMAILS_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[Loan Agent] Error loading processed emails:', error);
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
      const accessToken = process.env.GMAIL_ACCESS_TOKEN;
      const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

      if (accessToken && refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.isAuthenticated = true;
        console.log('[Loan Agent] Gmail tokens loaded from environment variables');
      }
    } catch (error) {
      console.error('[Loan Agent] Error loading tokens:', error);
    }
  }

  protected onMessageSent(message: AgentMessage): void {
    console.log(`[Loan Agent] Sent ${message.type} message to ${message.to}`);
  }

  protected onMessageReceived(message: AgentMessage): void {
    console.log(`[Loan Agent] Received ${message.type} message from ${message.from}`);

    if (message.type === 'request') {
      if (message.data?.action === 'process-loan-emails') {
        this.processLoanEmailsManually();
      }
    }
  }

  /**
   * Manually process loan emails (for API endpoint)
   */
  async processLoanEmailsManually(): Promise<{
    processedCount: number;
    quarterlyCount: number;
    rateChangeCount: number;
    errors?: string[];
  }> {
    if (!this.isGmailAuthenticated()) {
      this.loadTokens();
    }

    if (!this.isGmailAuthenticated()) {
      throw new Error('Gmail not authenticated. Please connect Gmail first.');
    }

    console.log('[Loan Agent] Manual loan email processing triggered...');

    try {
      // Fetch recent emails (including read ones for manual processing)
      const { emails } = await fetchEmails(
        this.accessToken!,
        this.refreshToken!,
        {
          maxResults: 20,
          query: 'in:inbox',
        }
      );

      if (emails.length === 0) {
        return { processedCount: 0, quarterlyCount: 0, rateChangeCount: 0 };
      }

      console.log(`[Loan Agent] Found ${emails.length} emails for manual processing`);

      let processedCount = 0;
      let quarterlyCount = 0;
      let rateChangeCount = 0;
      const errors: string[] = [];

      for (const email of emails) {
        if (this.processedEmails.has(email.id)) {
          continue;
        }

        try {
          const detection = await detectLoanEmail(email);

          if (!detection.isLoanEmail || detection.confidence < 0.3) {
            this.markEmailAsProcessed(email.id);
            processedCount++;
            continue;
          }

          if (detection.emailType === 'quarterly-summary') {
            const result = await this.processQuarterlySummary(email);
            if (result) {
              quarterlyCount++;
              this.markEmailAsProcessed(email.id, result.loanId, result.snapshotId);
            }
          } else if (detection.emailType === 'interest-rate-change') {
            const result = await this.processInterestRateChange(email);
            if (result) {
              rateChangeCount++;
              this.markEmailAsProcessed(email.id, result.loanId);
            }
          }

          processedCount++;
        } catch (error: any) {
          errors.push(`Email ${email.id}: ${error.message}`);
        }
      }

      return {
        processedCount,
        quarterlyCount,
        rateChangeCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error('[Loan Agent] Manual processing error:', error);
      throw error;
    }
  }
}
