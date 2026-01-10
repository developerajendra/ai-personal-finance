import fs from "fs";
import path from "path";

const PF_DATA_DIR = path.join(process.cwd(), "data", "pfData");

export interface PPFAccount {
  id: string;
  memberId?: string;
  memberName?: string;
  establishmentId?: string;
  establishmentName?: string;
  // Deposit values
  depositEmployeeShare: number;
  depositEmployerShare: number;
  // Withdraw values
  withdrawEmployeeShare: number;
  withdrawEmployerShare: number;
  // Pension contribution
  pensionContribution: number;
  // Grand Total
  grandTotal: number;
  extractedFrom?: string; // PDF filename
  extractedAt: string;
  rawData?: any; // Store raw extracted data
}

// Ensure pfData directory exists
function ensurePfDataDir() {
  if (!fs.existsSync(PF_DATA_DIR)) {
    fs.mkdirSync(PF_DATA_DIR, { recursive: true });
    console.log(`📁 Created pfData directory: ${PF_DATA_DIR}`);
  }
}

// Get JSON file path for PPF accounts
function getPPFAccountsPath(): string {
  return path.join(PF_DATA_DIR, "ppfAccounts.json");
}

// Get JSON file path for a specific PDF's extracted data
function getPDFDataPath(filename: string): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return path.join(PF_DATA_DIR, `${safeFilename}.json`);
}

// Initialize PPF accounts file
function initializePPFFile() {
  ensurePfDataDir();
  const filePath = getPPFAccountsPath();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), "utf-8");
    console.log(`📄 Initialized PPF accounts file: ${filePath}`);
  }
}

// Load all PPF accounts
export function loadPPFAccounts(): PPFAccount[] {
  try {
    ensurePfDataDir();
    initializePPFFile();
    const filePath = getPPFAccountsPath();

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`❌ Error loading PPF accounts:`, error);
    return [];
  }
}

// Save PPF accounts
export function savePPFAccounts(accounts: PPFAccount[]): void {
  try {
    ensurePfDataDir();
    const filePath = getPPFAccountsPath();
    const jsonString = JSON.stringify(accounts, null, 2);
    fs.writeFileSync(filePath, jsonString, "utf-8");
    console.log(`💾 Saved ${accounts.length} PPF accounts to JSON`);
  } catch (error) {
    console.error(`❌ Error saving PPF accounts:`, error);
    throw error;
  }
}

// Add or update PPF account
export function savePPFAccount(account: PPFAccount): void {
  const accounts = loadPPFAccounts();
  const existingIndex = accounts.findIndex((acc) => acc.id === account.id);
  
  if (existingIndex >= 0) {
    accounts[existingIndex] = account;
  } else {
    accounts.push(account);
  }
  
  savePPFAccounts(accounts);
}

// Save raw PDF extraction data
export function savePDFExtractionData(filename: string, data: any): void {
  try {
    ensurePfDataDir();
    const filePath = getPDFDataPath(filename);
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonString, "utf-8");
    console.log(`💾 Saved PDF extraction data: ${filename}`);
  } catch (error) {
    console.error(`❌ Error saving PDF extraction data:`, error);
    throw error;
  }
}

// Load raw PDF extraction data
export function loadPDFExtractionData(filename: string): any | null {
  try {
    const filePath = getPDFDataPath(filename);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error loading PDF extraction data:`, error);
    return null;
  }
}

// Get all PDF files in pfData directory
export function getPDFFiles(): string[] {
  try {
    ensurePfDataDir();
    const files = fs.readdirSync(PF_DATA_DIR);
    return files.filter((file) => file.toLowerCase().endsWith(".pdf"));
  } catch (error) {
    console.error(`❌ Error reading PDF files:`, error);
    return [];
  }
}
