import fs from "fs";
import path from "path";
import { LoanMonthlySnapshot } from "@/core/types";
import { loadFromJson, saveToJson, initializeStorage } from "./jsonStorageService";

const DATA_DIR = path.join(process.cwd(), "data");
const LOANS_DIR = path.join(DATA_DIR, "loans");
const ANALYTICS_FILE = path.join(LOANS_DIR, "loanAnalytics.json");
const OLD_ANALYTICS_FILE = path.join(DATA_DIR, "loanAnalytics.json");

// Ensure analytics file exists
function ensureAnalyticsFile() {
  // Create loans directory if it doesn't exist
  if (!fs.existsSync(LOANS_DIR)) {
    fs.mkdirSync(LOANS_DIR, { recursive: true });
  }
  
  // Migrate old file if it exists
  if (fs.existsSync(OLD_ANALYTICS_FILE) && !fs.existsSync(ANALYTICS_FILE)) {
    try {
      fs.copyFileSync(OLD_ANALYTICS_FILE, ANALYTICS_FILE);
      console.log('[Loan Analytics] Migrated loanAnalytics.json to data/loans/');
    } catch (error) {
      console.error('[Loan Analytics] Error migrating file:', error);
    }
  }
  
  if (!fs.existsSync(ANALYTICS_FILE)) {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

// Load all loan snapshots
export function loadLoanSnapshots(): LoanMonthlySnapshot[] {
  try {
    ensureAnalyticsFile();
    const content = fs.readFileSync(ANALYTICS_FILE, "utf-8");
    const data = JSON.parse(content || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("❌ Error loading loan snapshots:", error);
    return [];
  }
}

// Save loan snapshots
export function saveLoanSnapshots(snapshots: LoanMonthlySnapshot[]): void {
  try {
    ensureAnalyticsFile();
    const jsonString = JSON.stringify(snapshots, null, 2);
    fs.writeFileSync(ANALYTICS_FILE, jsonString, "utf-8");
    console.log(`💾 Saved ${snapshots.length} loan snapshots to analytics`);
  } catch (error) {
    console.error("❌ Error saving loan snapshots:", error);
    throw error;
  }
}

// Get snapshot by loan, year, and month
export function getLoanSnapshot(
  loanId: string,
  year: number,
  month: number
): LoanMonthlySnapshot | null {
  const snapshots = loadLoanSnapshots();
  return (
    snapshots.find(
      (s) => s.loanId === loanId && s.year === year && s.month === month
    ) || null
  );
}

// Get all snapshots for a loan in a year
export function getLoanSnapshotsByYear(
  loanId: string,
  year: number
): LoanMonthlySnapshot[] {
  const snapshots = loadLoanSnapshots();
  return snapshots
    .filter((s) => s.loanId === loanId && s.year === year)
    .sort((a, b) => a.month - b.month);
}

// Get all snapshots for a specific month (all loans)
export function getLoanSnapshotsByMonth(
  year: number,
  month: number
): LoanMonthlySnapshot[] {
  const snapshots = loadLoanSnapshots();
  return snapshots.filter((s) => s.year === year && s.month === month);
}

// Get all snapshots for a loan (all years)
export function getLoanSnapshots(loanId: string): LoanMonthlySnapshot[] {
  const snapshots = loadLoanSnapshots();
  return snapshots
    .filter((s) => s.loanId === loanId)
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
}

// Create or update a loan snapshot
// IMPORTANT: This function only updates the specific quarter (year-month) being saved
// It does NOT recalculate or modify other quarters' data
export function saveLoanMonthlySnapshot(
  snapshot: LoanMonthlySnapshot
): LoanMonthlySnapshot {
  const snapshots = loadLoanSnapshots();
  const existingIndex = snapshots.findIndex(
    (s) =>
      s.loanId === snapshot.loanId &&
      s.year === snapshot.year &&
      s.month === snapshot.month
  );

  if (existingIndex >= 0) {
    // Update existing snapshot for THIS specific quarter only
    // Preserve createdAt, only update the data and updatedAt
    snapshots[existingIndex] = {
      ...snapshot,
      createdAt: snapshots[existingIndex].createdAt, // Preserve original creation date
      updatedAt: new Date().toISOString(),
    };
    console.log(`[Loan Analytics] Updated snapshot for ${snapshot.year}-${snapshot.month} (quarter end)`);
  } else {
    // Add new snapshot for this quarter
    snapshots.push(snapshot);
    console.log(`[Loan Analytics] Created new snapshot for ${snapshot.year}-${snapshot.month} (quarter end)`);
  }

  saveLoanSnapshots(snapshots);
  return existingIndex >= 0 ? snapshots[existingIndex] : snapshot;
}

// Get available years for loan analytics
export function getAvailableYearsForLoans(): number[] {
  const snapshots = loadLoanSnapshots();
  const years = Array.from(new Set(snapshots.map((s) => s.year)));
  return years.sort((a, b) => b - a); // Most recent first
}

// Get available months for a year
export function getAvailableMonthsForLoans(year: number): number[] {
  const snapshots = loadLoanSnapshots();
  return snapshots
    .filter((s) => s.year === year)
    .map((s) => s.month)
    .filter((month, index, self) => self.indexOf(month) === index) // Unique
    .sort((a, b) => a - b);
}

// Get loans with snapshots for a year
export function getLoansWithSnapshots(year: number): string[] {
  const snapshots = loadLoanSnapshots();
  const loanIds = snapshots
    .filter((s) => s.year === year)
    .map((s) => s.loanId)
    .filter((id, index, self) => self.indexOf(id) === index); // Unique
  return loanIds;
}

// Calculate growth metrics between two snapshots
export function calculateLoanGrowthMetrics(
  current: LoanMonthlySnapshot,
  previous?: LoanMonthlySnapshot
): {
  outstandingAmountChange: number; // Absolute change
  outstandingAmountChangePercent: number; // Percentage change
  principalPaidChange: number;
  interestPaidChange: number;
  emiAmountChange: number;
  interestRateChange: number;
  tenureChange: number; // Change in remaining tenure (negative means reduced)
} {
  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  if (!previous) {
    return {
      outstandingAmountChange: 0,
      outstandingAmountChangePercent: 0,
      principalPaidChange: 0,
      interestPaidChange: 0,
      emiAmountChange: 0,
      interestRateChange: 0,
      tenureChange: 0,
    };
  }

  return {
    outstandingAmountChange: current.outstandingAmount - previous.outstandingAmount,
    outstandingAmountChangePercent: calculatePercentageChange(
      current.outstandingAmount,
      previous.outstandingAmount
    ),
    principalPaidChange: current.principalPaid - previous.principalPaid,
    interestPaidChange: current.interestPaid - previous.interestPaid,
    emiAmountChange: current.emiAmount - previous.emiAmount,
    interestRateChange: current.interestRate - previous.interestRate,
    tenureChange: current.remainingTenureMonths - previous.remainingTenureMonths,
  };
}

// Get previous snapshot for a loan
export function getPreviousLoanSnapshot(
  snapshot: LoanMonthlySnapshot
): LoanMonthlySnapshot | null {
  const snapshots = loadLoanSnapshots();
  const loanSnapshots = snapshots
    .filter((s) => s.loanId === snapshot.loanId)
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

  const currentIndex = loanSnapshots.findIndex(
    (s) => s.year === snapshot.year && s.month === snapshot.month
  );

  if (currentIndex <= 0) {
    // No previous snapshot
    if (snapshot.month > 1) {
      // Try previous month of same year
      return getLoanSnapshot(snapshot.loanId, snapshot.year, snapshot.month - 1);
    } else {
      // Try December of previous year
      return getLoanSnapshot(snapshot.loanId, snapshot.year - 1, 12);
    }
  }

  return loanSnapshots[currentIndex - 1] || null;
}

// Generate missing monthly snapshots based on previous data
// This is used when quarterly summary is 2 months old and we need to generate next 2 months
export function generateMissingMonthlySnapshots(
  loanId: string,
  lastSnapshot: LoanMonthlySnapshot,
  targetYear: number,
  targetMonth: number
): LoanMonthlySnapshot[] {
  const generated: LoanMonthlySnapshot[] = [];
  const lastDate = new Date(lastSnapshot.year, lastSnapshot.month - 1);
  const targetDate = new Date(targetYear, targetMonth - 1);

  // Calculate months between last snapshot and target
  const monthsDiff = (targetDate.getFullYear() - lastDate.getFullYear()) * 12 +
    (targetDate.getMonth() - lastDate.getMonth());

  if (monthsDiff <= 0) {
    return generated; // No months to generate
  }

  // Calculate average monthly reduction in outstanding amount
  const previousSnapshots = getLoanSnapshots(loanId)
    .filter((s) => {
      const sDate = new Date(s.year, s.month - 1);
      return sDate < lastDate;
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    })
    .slice(0, 3); // Get last 3 snapshots for trend

  let avgMonthlyReduction = 0;
  if (previousSnapshots.length >= 2) {
    const reductions = [];
    for (let i = 0; i < previousSnapshots.length - 1; i++) {
      const diff = previousSnapshots[i].outstandingAmount - previousSnapshots[i + 1].outstandingAmount;
      reductions.push(diff);
    }
    avgMonthlyReduction = reductions.reduce((a, b) => a + b, 0) / reductions.length;
  } else if (lastSnapshot.emiAmount > 0) {
    // Estimate based on EMI (rough approximation: 60% principal, 40% interest)
    avgMonthlyReduction = lastSnapshot.emiAmount * 0.6;
  }

  // Generate snapshots for missing months
  for (let i = 1; i <= monthsDiff; i++) {
    const monthDate = new Date(lastDate);
    monthDate.setMonth(monthDate.getMonth() + i);
    
    const month = monthDate.getMonth() + 1;
    const year = monthDate.getFullYear();

    // Check if snapshot already exists
    if (getLoanSnapshot(loanId, year, month)) {
      continue;
    }

    // Calculate estimated outstanding amount
    const estimatedOutstanding = Math.max(
      0,
      lastSnapshot.outstandingAmount - (avgMonthlyReduction * i)
    );

    // Estimate cumulative principal and interest paid (till date)
    // Add incremental amounts to the last snapshot's cumulative values
    const estimatedPrincipalPaid = lastSnapshot.principalPaid + (avgMonthlyReduction * i);
    const estimatedInterestPaid = lastSnapshot.interestPaid + ((lastSnapshot.emiAmount - avgMonthlyReduction) * i);

    const generatedSnapshot: LoanMonthlySnapshot = {
      id: `loan-snapshot-${loanId}-${year}-${month}-${Date.now()}`,
      loanId,
      year,
      month,
      outstandingAmount: estimatedOutstanding,
      principalPaid: estimatedPrincipalPaid,
      interestPaid: estimatedInterestPaid,
      emiAmount: lastSnapshot.emiAmount,
      interestRate: lastSnapshot.interestRate,
      remainingTenureMonths: Math.max(
        0,
        lastSnapshot.remainingTenureMonths - i
      ),
      snapshotDate: new Date(year, month, 0).toISOString(), // Last day of month
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    generated.push(generatedSnapshot);
    saveLoanMonthlySnapshot(generatedSnapshot);
  }

  return generated;
}
