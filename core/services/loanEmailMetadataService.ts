import fs from "fs";
import path from "path";

// On Vercel, process.cwd() is read-only; use /tmp which is the only writable path
const BASE_DIR = process.env.VERCEL ? "/tmp" : process.cwd();
const DATA_DIR = path.join(BASE_DIR, "data");
const LOANS_DIR = path.join(DATA_DIR, "loans");
const METADATA_FILE = path.join(LOANS_DIR, "loanEmailMetadata.json");
const OLD_METADATA_FILE = path.join(DATA_DIR, "loanEmailMetadata.json");

export interface LoanEmailMetadata {
  loanId: string;
  firstEmailDate: string; // ISO date string
  firstEmailTitle: string;
  firstEmailId: string;
  lastEmailDate: string; // ISO date string
  lastEmailTitle: string;
  lastEmailId: string;
  totalEmailsProcessed: number;
  emails: Array<{
    emailId: string;
    emailTitle: string;
    emailDate: string; // ISO date string
    processedAt: string; // ISO date string
    snapshotDate: string; // YYYY-MM-DD format
  }>;
}

interface LoanEmailMetadataStore {
  loans: Record<string, LoanEmailMetadata>;
}

// Ensure metadata file exists
function ensureMetadataFile() {
  // Create loans directory if it doesn't exist
  if (!fs.existsSync(LOANS_DIR)) {
    fs.mkdirSync(LOANS_DIR, { recursive: true });
  }
  
  // Migrate old file if it exists
  if (fs.existsSync(OLD_METADATA_FILE) && !fs.existsSync(METADATA_FILE)) {
    try {
      fs.copyFileSync(OLD_METADATA_FILE, METADATA_FILE);
      console.log('[Loan Email Metadata] Migrated loanEmailMetadata.json to data/loans/');
    } catch (error) {
      console.error('[Loan Email Metadata] Error migrating file:', error);
    }
  }
  
  if (!fs.existsSync(METADATA_FILE)) {
    const store: LoanEmailMetadataStore = { loans: {} };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(store, null, 2), "utf-8");
  }
}

// Load metadata for all loans
function loadMetadataStore(): LoanEmailMetadataStore {
  try {
    ensureMetadataFile();
    const content = fs.readFileSync(METADATA_FILE, "utf-8");
    const data = JSON.parse(content || '{"loans":{}}');
    return data;
  } catch (error) {
    console.error("❌ Error loading loan email metadata:", error);
    return { loans: {} };
  }
}

// Save metadata store
function saveMetadataStore(store: LoanEmailMetadataStore): void {
  try {
    ensureMetadataFile();
    const jsonString = JSON.stringify(store, null, 2);
    fs.writeFileSync(METADATA_FILE, jsonString, "utf-8");
  } catch (error) {
    console.error("❌ Error saving loan email metadata:", error);
    throw error;
  }
}

// Get metadata for a loan
export function getLoanEmailMetadata(loanId: string): LoanEmailMetadata | null {
  const store = loadMetadataStore();
  return store.loans[loanId] || null;
}

// Record an email processing event
export function recordEmailProcessing(
  loanId: string,
  emailId: string,
  emailTitle: string,
  emailDate: string,
  snapshotDate: string
): LoanEmailMetadata {
  const store = loadMetadataStore();
  let metadata = store.loans[loanId];

  if (!metadata) {
    // First email for this loan
    metadata = {
      loanId,
      firstEmailDate: emailDate,
      firstEmailTitle: emailTitle,
      firstEmailId: emailId,
      lastEmailDate: emailDate,
      lastEmailTitle: emailTitle,
      lastEmailId: emailId,
      totalEmailsProcessed: 1,
      emails: [],
    };
  } else {
    // Check if this is the first email (earliest date)
    const emailDateObj = new Date(emailDate);
    const firstEmailDateObj = new Date(metadata.firstEmailDate);
    
    if (emailDateObj < firstEmailDateObj) {
      metadata.firstEmailDate = emailDate;
      metadata.firstEmailTitle = emailTitle;
      metadata.firstEmailId = emailId;
    }

    // Check if this is the latest email (most recent date)
    const lastEmailDateObj = new Date(metadata.lastEmailDate);
    if (emailDateObj > lastEmailDateObj) {
      metadata.lastEmailDate = emailDate;
      metadata.lastEmailTitle = emailTitle;
      metadata.lastEmailId = emailId;
    }

    metadata.totalEmailsProcessed += 1;
  }

  // Add to emails array (avoid duplicates)
  const existingEmailIndex = metadata.emails.findIndex(e => e.emailId === emailId);
  if (existingEmailIndex === -1) {
    metadata.emails.push({
      emailId,
      emailTitle,
      emailDate,
      processedAt: new Date().toISOString(),
      snapshotDate,
    });
    // Sort emails by date
    metadata.emails.sort((a, b) => new Date(a.emailDate).getTime() - new Date(b.emailDate).getTime());
  } else {
    // Update existing entry
    metadata.emails[existingEmailIndex] = {
      emailId,
      emailTitle,
      emailDate,
      processedAt: metadata.emails[existingEmailIndex].processedAt,
      snapshotDate,
    };
  }

  store.loans[loanId] = metadata;
  saveMetadataStore(store);
  return metadata;
}

// Get all metadata
export function getAllLoanEmailMetadata(): LoanEmailMetadata[] {
  const store = loadMetadataStore();
  return Object.values(store.loans);
}
