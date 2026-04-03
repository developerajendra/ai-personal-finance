import * as financialSnapshotRepo from "@/core/db/repositories/financialSnapshotRepository";
import type { FinancialSnapshot } from "@/core/types";

export function loadSnapshots(userId: string): FinancialSnapshot[] {
  return financialSnapshotRepo.findByUserId(userId);
}

export function getSnapshot(userId: string, year: number, month?: number): FinancialSnapshot | null {
  return financialSnapshotRepo.findByYearMonth(userId, year, month);
}

export function getSnapshotsByYear(userId: string, year: number): FinancialSnapshot[] {
  return financialSnapshotRepo.findByYear(userId, year);
}

export function saveSnapshot(userId: string, snapshot: FinancialSnapshot): FinancialSnapshot {
  return financialSnapshotRepo.upsert(userId, snapshot);
}

export function getAvailableYears(userId: string): number[] {
  return financialSnapshotRepo.getAvailableYears(userId);
}

export function getAvailableMonths(userId: string, year: number): number[] {
  return financialSnapshotRepo.getAvailableMonths(userId, year);
}

export function calculateGrowthMetrics(
  userId: string,
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
  const pct = (c: number, p: number) => (p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100);

  const monthlyGrowth = previous
    ? {
        netWorth: pct(current.netWorth, previous.netWorth),
        totalInvestments: pct(current.totalInvestments, previous.totalInvestments),
        totalIncome: pct(current.totalIncome, previous.totalIncome),
        totalExpenses: pct(current.totalExpenses, previous.totalExpenses),
      }
    : { netWorth: 0, totalInvestments: 0, totalIncome: 0, totalExpenses: 0 };

  const lastYearSnapshot =
    current.month !== undefined
      ? getSnapshot(userId, current.year - 1, current.month)
      : getSnapshot(userId, current.year - 1);

  const yearlyGrowth = lastYearSnapshot
    ? {
        netWorth: pct(current.netWorth, lastYearSnapshot.netWorth),
        totalInvestments: pct(current.totalInvestments, lastYearSnapshot.totalInvestments),
        totalIncome: pct(current.totalIncome, lastYearSnapshot.totalIncome),
        totalExpenses: pct(current.totalExpenses, lastYearSnapshot.totalExpenses),
      }
    : { netWorth: 0, totalInvestments: 0, totalIncome: 0, totalExpenses: 0 };

  return { monthlyGrowth, yearlyGrowth };
}

export function getPreviousSnapshot(userId: string, snapshot: FinancialSnapshot): FinancialSnapshot | null {
  if (snapshot.month !== undefined) {
    if (snapshot.month > 1) {
      return getSnapshot(userId, snapshot.year, snapshot.month - 1);
    }
    return getSnapshot(userId, snapshot.year - 1, 12);
  }
  return getSnapshot(userId, snapshot.year - 1);
}
