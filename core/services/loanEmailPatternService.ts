import fs from "fs";
import path from "path";
import { loadFromJson, saveToJson, initializeStorage } from "./jsonStorageService";

// On Vercel, process.cwd() is read-only; use /tmp which is the only writable path
const BASE_DIR = process.env.VERCEL ? "/tmp" : process.cwd();
const DATA_DIR = path.join(BASE_DIR, "data");
const LOANS_DIR = path.join(DATA_DIR, "loans");
const PATTERNS_FILE = path.join(LOANS_DIR, "loanEmailPatterns.json");
const OLD_PATTERNS_FILE = path.join(DATA_DIR, "loanEmailPatterns.json");

export interface LoanEmailPattern {
  id: string;
  title: string; // Email subject pattern/title
  type: "quarterly-summary" | "interest-rate-change" | "other";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Ensure patterns file exists
function ensurePatternsFile() {
  // Create loans directory if it doesn't exist
  if (!fs.existsSync(LOANS_DIR)) {
    fs.mkdirSync(LOANS_DIR, { recursive: true });
  }
  
  // Migrate old file if it exists
  if (fs.existsSync(OLD_PATTERNS_FILE) && !fs.existsSync(PATTERNS_FILE)) {
    try {
      fs.copyFileSync(OLD_PATTERNS_FILE, PATTERNS_FILE);
      console.log('[Loan Email Patterns] Migrated loanEmailPatterns.json to data/loans/');
    } catch (error) {
      console.error('[Loan Email Patterns] Error migrating file:', error);
    }
  }
  
  if (!fs.existsSync(PATTERNS_FILE)) {
    // Initialize with default patterns
    const defaultPatterns: LoanEmailPattern[] = [
      {
        id: "pattern-1",
        title: "Quarterly Loan Summary Update - Property Loan",
        type: "quarterly-summary",
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "pattern-2",
        title: "Important Update: Change in Your Loan Interest Rate",
        type: "interest-rate-change",
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(PATTERNS_FILE, JSON.stringify(defaultPatterns, null, 2), "utf-8");
  }
}

// Load all patterns
export function loadLoanEmailPatterns(): LoanEmailPattern[] {
  try {
    ensurePatternsFile();
    const content = fs.readFileSync(PATTERNS_FILE, "utf-8");
    const data = JSON.parse(content || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("❌ Error loading loan email patterns:", error);
    return [];
  }
}

// Save patterns
export function saveLoanEmailPatterns(patterns: LoanEmailPattern[]): void {
  try {
    ensurePatternsFile();
    const jsonString = JSON.stringify(patterns, null, 2);
    fs.writeFileSync(PATTERNS_FILE, jsonString, "utf-8");
    console.log(`💾 Saved ${patterns.length} loan email patterns`);
  } catch (error) {
    console.error("❌ Error saving loan email patterns:", error);
    throw error;
  }
}

// Get enabled patterns by type
export function getEnabledPatterns(type?: "quarterly-summary" | "interest-rate-change" | "other"): LoanEmailPattern[] {
  const patterns = loadLoanEmailPatterns();
  const enabled = patterns.filter(p => p.enabled);
  if (type) {
    return enabled.filter(p => p.type === type);
  }
  return enabled;
}

// Add a new pattern
export function addLoanEmailPattern(pattern: Omit<LoanEmailPattern, "id" | "createdAt" | "updatedAt">): LoanEmailPattern {
  const patterns = loadLoanEmailPatterns();
  const newPattern: LoanEmailPattern = {
    ...pattern,
    id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  patterns.push(newPattern);
  saveLoanEmailPatterns(patterns);
  return newPattern;
}

// Update a pattern
export function updateLoanEmailPattern(id: string, updates: Partial<LoanEmailPattern>): LoanEmailPattern | null {
  const patterns = loadLoanEmailPatterns();
  const index = patterns.findIndex(p => p.id === id);
  if (index === -1) return null;

  patterns[index] = {
    ...patterns[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveLoanEmailPatterns(patterns);
  return patterns[index];
}

// Delete a pattern
export function deleteLoanEmailPattern(id: string): boolean {
  const patterns = loadLoanEmailPatterns();
  const filtered = patterns.filter(p => p.id !== id);
  if (filtered.length === patterns.length) return false; // Pattern not found

  saveLoanEmailPatterns(filtered);
  return true;
}

// Get pattern by ID
export function getLoanEmailPattern(id: string): LoanEmailPattern | null {
  const patterns = loadLoanEmailPatterns();
  return patterns.find(p => p.id === id) || null;
}
