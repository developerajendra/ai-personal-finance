import * as financialSnapshotRepo from "@/core/db/repositories/financialSnapshotRepository";
import type { FinancialSnapshot } from "@/core/types";

export async function loadSnapshots(userId: string): Promise<FinancialSnapshot[]> {
  return financialSnapshotRepo.findByUserId(userId);
}

export async function getSnapshot(userId: string, year: number, month?: number): Promise<FinancialSnapshot | null> {
  return financialSnapshotRepo.findByYearMonth(userId, year, month);
}

export async function getSnapshotsByYear(userId: string, year: number): Promise<FinancialSnapshot[]> {
  return financialSnapshotRepo.findByYear(userId, year);
}

export async function saveSnapshot(userId: string, snapshot: FinancialSnapshot): Promise<FinancialSnapshot> {
  return financialSnapshotRepo.upsert(userId, snapshot);
}

export async function getAvailableYears(userId: string): Promise<number[]> {
  return financialSnapshotRepo.getAvailableYears(userId);
}

export async function getAvailableMonths(userId: string, year: number): Promise<number[]> {
  return financialSnapshotRepo.getAvailableMonths(userId, year);
}

export async function calculateGrowthMetrics(
  userId: string,
  current: FinancialSnapshot,
  previous?: FinancialSnapshot
): Promise<{
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
}> {
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
      ? await getSnapshot(userId, current.year - 1, current.month)
      : await getSnapshot(userId, current.year - 1);

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

export async function getPreviousSnapshot(userId: string, snapshot: FinancialSnapshot): Promise<FinancialSnapshot | null> {
  if (snapshot.month !== undefined) {
    if (snapshot.month > 1) {
      return await getSnapshot(userId, snapshot.year, snapshot.month - 1);
    }
    return await getSnapshot(userId, snapshot.year - 1, 12);
  }
  return await getSnapshot(userId, snapshot.year - 1);
}
