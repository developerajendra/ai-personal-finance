import fs from "fs";
import path from "path";
import { FinancialSnapshot } from "@/core/types";
import { loadFromJson, saveToJson, initializeStorage } from "./jsonStorageService";

const DATA_DIR = path.join(process.cwd(), "data");
const ARCHIVE_FILE = path.join(DATA_DIR, "financialArchive.json");

// Ensure archive file exists
function ensureArchiveFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARCHIVE_FILE)) {
    fs.writeFileSync(ARCHIVE_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

// Load all snapshots
export function loadSnapshots(): FinancialSnapshot[] {
  try {
    ensureArchiveFile();
    const content = fs.readFileSync(ARCHIVE_FILE, "utf-8");
    const data = JSON.parse(content || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("❌ Error loading snapshots:", error);
    return [];
  }
}

// Save snapshots
export function saveSnapshots(snapshots: FinancialSnapshot[]): void {
  try {
    ensureArchiveFile();
    const jsonString = JSON.stringify(snapshots, null, 2);
    fs.writeFileSync(ARCHIVE_FILE, jsonString, "utf-8");
    console.log(`💾 Saved ${snapshots.length} snapshots to archive`);
  } catch (error) {
    console.error("❌ Error saving snapshots:", error);
    throw error;
  }
}

// Get snapshot by year and month
export function getSnapshot(year: number, month?: number): FinancialSnapshot | null {
  const snapshots = loadSnapshots();
  return (
    snapshots.find(
      (s) => s.year === year && (month === undefined ? s.month === undefined : s.month === month)
    ) || null
  );
}

// Get all snapshots for a year
export function getSnapshotsByYear(year: number): FinancialSnapshot[] {
  const snapshots = loadSnapshots();
  return snapshots.filter((s) => s.year === year).sort((a, b) => {
    // Sort by month if available, otherwise by snapshot date
    if (a.month !== undefined && b.month !== undefined) {
      return a.month - b.month;
    }
    return new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime();
  });
}

// Create or update a snapshot
export function saveSnapshot(snapshot: FinancialSnapshot): FinancialSnapshot {
  const snapshots = loadSnapshots();
  const existingIndex = snapshots.findIndex(
    (s) =>
      s.year === snapshot.year &&
      (snapshot.month === undefined
        ? s.month === undefined
        : s.month === snapshot.month)
  );

  if (existingIndex >= 0) {
    // Update existing snapshot
    snapshots[existingIndex] = {
      ...snapshot,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Add new snapshot
    snapshots.push(snapshot);
  }

  saveSnapshots(snapshots);
  return existingIndex >= 0 ? snapshots[existingIndex] : snapshot;
}

// Get available years
export function getAvailableYears(): number[] {
  const snapshots = loadSnapshots();
  const years = Array.from(new Set(snapshots.map((s) => s.year)));
  return years.sort((a, b) => b - a); // Most recent first
}

// Get available months for a year
export function getAvailableMonths(year: number): number[] {
  const snapshots = loadSnapshots();
  return snapshots
    .filter((s) => s.year === year && s.month !== undefined)
    .map((s) => s.month!)
    .sort((a, b) => a - b);
}

// Calculate growth metrics
export function calculateGrowthMetrics(
  current: FinancialSnapshot,
  previous?: FinancialSnapshot
): {
  monthlyGrowth: {
    netWorth: number;
    totalInvestments: number;
    totalIncome: number;
    totalExpenses: number;
  };
  yearlyGrowth: {
    netWorth: number;
    totalInvestments: number;
    totalIncome: number;
    totalExpenses: number;
  };
} {
  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Monthly growth (from previous month)
  const monthlyGrowth = previous
    ? {
        netWorth: calculatePercentageChange(current.netWorth, previous.netWorth),
        totalInvestments: calculatePercentageChange(
          current.totalInvestments,
          previous.totalInvestments
        ),
        totalIncome: calculatePercentageChange(current.totalIncome, previous.totalIncome),
        totalExpenses: calculatePercentageChange(current.totalExpenses, previous.totalExpenses),
      }
    : {
        netWorth: 0,
        totalInvestments: 0,
        totalIncome: 0,
        totalExpenses: 0,
      };

  // Yearly growth (from same month last year)
  const lastYearSnapshot = current.month !== undefined
    ? getSnapshot(current.year - 1, current.month)
    : getSnapshot(current.year - 1);

  const yearlyGrowth = lastYearSnapshot
    ? {
        netWorth: calculatePercentageChange(current.netWorth, lastYearSnapshot.netWorth),
        totalInvestments: calculatePercentageChange(
          current.totalInvestments,
          lastYearSnapshot.totalInvestments
        ),
        totalIncome: calculatePercentageChange(current.totalIncome, lastYearSnapshot.totalIncome),
        totalExpenses: calculatePercentageChange(
          current.totalExpenses,
          lastYearSnapshot.totalExpenses
        ),
      }
    : {
        netWorth: 0,
        totalInvestments: 0,
        totalIncome: 0,
        totalExpenses: 0,
      };

  return { monthlyGrowth, yearlyGrowth };
}

// Get previous snapshot (for monthly growth calculation)
export function getPreviousSnapshot(snapshot: FinancialSnapshot): FinancialSnapshot | null {
  const snapshots = loadSnapshots();
  
  if (snapshot.month !== undefined) {
    // For monthly snapshots, get previous month
    if (snapshot.month > 1) {
      return getSnapshot(snapshot.year, snapshot.month - 1);
    } else {
      // Previous month is December of previous year
      return getSnapshot(snapshot.year - 1, 12);
    }
  } else {
    // For yearly snapshots, get previous year
    return getSnapshot(snapshot.year - 1);
  }
}
