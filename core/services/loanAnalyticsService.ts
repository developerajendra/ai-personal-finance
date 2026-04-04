import * as loanSnapshotRepo from "@/core/db/repositories/loanSnapshotRepository";
import type { LoanMonthlySnapshot } from "@/core/types";

export async function loadLoanSnapshots(userId: string): Promise<LoanMonthlySnapshot[]> {
  return loanSnapshotRepo.findByUserId(userId);
}

export async function getLoanSnapshot(
  userId: string,
  loanId: string,
  year: number,
  month: number
): Promise<LoanMonthlySnapshot | null> {
  return loanSnapshotRepo.findByLoanAndMonth(userId, loanId, year, month);
}

export async function getLoanSnapshotsByYear(
  userId: string,
  loanId: string,
  year: number
): Promise<LoanMonthlySnapshot[]> {
  return loanSnapshotRepo.findByYear(userId, loanId, year);
}

export async function getLoanSnapshotsByMonth(
  userId: string,
  year: number,
  month: number
): Promise<LoanMonthlySnapshot[]> {
  return loanSnapshotRepo.findByMonth(userId, year, month);
}

export async function getLoanSnapshots(userId: string, loanId: string): Promise<LoanMonthlySnapshot[]> {
  return loanSnapshotRepo.findByLoanId(userId, loanId);
}

export async function getLatestLoanSnapshot(
  userId: string,
  loanId: string
): Promise<LoanMonthlySnapshot | null> {
  return loanSnapshotRepo.findLatest(userId, loanId);
}

export async function getEffectiveOutstandingAmount(
  userId: string,
  loan: { id: string; outstandingAmount: number }
): Promise<number> {
  const latest = await loanSnapshotRepo.findLatest(userId, loan.id);
  return latest ? latest.outstandingAmount : loan.outstandingAmount;
}

export async function saveLoanMonthlySnapshot(
  userId: string,
  snapshot: LoanMonthlySnapshot
): Promise<LoanMonthlySnapshot> {
  return loanSnapshotRepo.upsert(userId, snapshot);
}

export async function getAvailableYearsForLoans(userId: string): Promise<number[]> {
  return loanSnapshotRepo.getAvailableYears(userId);
}

export async function getAvailableMonthsForLoans(userId: string, year: number): Promise<number[]> {
  return loanSnapshotRepo.getAvailableMonths(userId, year);
}

export async function getLoansWithSnapshots(userId: string, year: number): Promise<string[]> {
  const snapshots = (await loanSnapshotRepo.findByUserId(userId)).filter((s) => s.year === year);
  return [...new Set(snapshots.map((s) => s.loanId))];
}

export function calculateLoanGrowthMetrics(
  current: LoanMonthlySnapshot,
  previous?: LoanMonthlySnapshot
): {
  outstandingAmountChange: number;
  outstandingAmountChangePercent: number;
  principalPaidChange: number;
  interestPaidChange: number;
  emiAmountChange: number;
  interestRateChange: number;
  tenureChange: number;
} {
  const pct = (c: number, p: number) => (p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100);

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
    outstandingAmountChangePercent: pct(current.outstandingAmount, previous.outstandingAmount),
    principalPaidChange: current.principalPaid - previous.principalPaid,
    interestPaidChange: current.interestPaid - previous.interestPaid,
    emiAmountChange: current.emiAmount - previous.emiAmount,
    interestRateChange: current.interestRate - previous.interestRate,
    tenureChange: current.remainingTenureMonths - previous.remainingTenureMonths,
  };
}

export async function getPreviousLoanSnapshot(
  userId: string,
  snapshot: LoanMonthlySnapshot
): Promise<LoanMonthlySnapshot | null> {
  const all = await loanSnapshotRepo.findByLoanId(userId, snapshot.loanId);
  const idx = all.findIndex((s) => s.year === snapshot.year && s.month === snapshot.month);
  if (idx > 0) return all[idx - 1];
  if (snapshot.month > 1) return await loanSnapshotRepo.findByLoanAndMonth(userId, snapshot.loanId, snapshot.year, snapshot.month - 1);
  return await loanSnapshotRepo.findByLoanAndMonth(userId, snapshot.loanId, snapshot.year - 1, 12);
}

export async function generateMissingMonthlySnapshots(
  userId: string,
  loanId: string,
  lastSnapshot: LoanMonthlySnapshot,
  targetYear: number,
  targetMonth: number
): Promise<LoanMonthlySnapshot[]> {
  const generated: LoanMonthlySnapshot[] = [];
  const lastDate = new Date(lastSnapshot.year, lastSnapshot.month - 1);
  const targetDate = new Date(targetYear, targetMonth - 1);

  const monthsDiff =
    (targetDate.getFullYear() - lastDate.getFullYear()) * 12 +
    (targetDate.getMonth() - lastDate.getMonth());

  if (monthsDiff <= 0) return generated;

  let prevOutstanding = lastSnapshot.outstandingAmount;
  let prevPrincipalPaid = lastSnapshot.principalPaid;
  let prevInterestPaid = lastSnapshot.interestPaid;
  const emiAmount = lastSnapshot.emiAmount;
  const annualRate = lastSnapshot.interestRate;
  const monthlyRate = annualRate / 12 / 100;

  for (let i = 1; i <= monthsDiff; i++) {
    const monthDate = new Date(lastDate);
    monthDate.setMonth(monthDate.getMonth() + i);
    const month = monthDate.getMonth() + 1;
    const year = monthDate.getFullYear();

    const existing = await loanSnapshotRepo.findByLoanAndMonth(userId, loanId, year, month);
    if (existing) {
      prevOutstanding = existing.outstandingAmount;
      prevPrincipalPaid = existing.principalPaid;
      prevInterestPaid = existing.interestPaid;
      continue;
    }

    const monthlyInterest = Math.round(prevOutstanding * monthlyRate * 100) / 100;
    const monthlyPrincipal = Math.round((emiAmount - monthlyInterest) * 100) / 100;
    const newOutstanding = Math.max(0, Math.round((prevOutstanding - monthlyPrincipal) * 100) / 100);
    const newPrincipalPaid = Math.round((prevPrincipalPaid + monthlyPrincipal) * 100) / 100;
    const newInterestPaid = Math.round((prevInterestPaid + monthlyInterest) * 100) / 100;

    const snap: LoanMonthlySnapshot = {
      id: `loan-snapshot-${loanId}-${year}-${month}-${Date.now()}`,
      loanId,
      year,
      month,
      outstandingAmount: newOutstanding,
      principalPaid: newPrincipalPaid,
      interestPaid: newInterestPaid,
      emiAmount,
      interestRate: annualRate,
      remainingTenureMonths: Math.max(0, lastSnapshot.remainingTenureMonths - i),
      snapshotDate: new Date(year, month, 0).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    generated.push(snap);
    await loanSnapshotRepo.upsert(userId, snap);

    prevOutstanding = newOutstanding;
    prevPrincipalPaid = newPrincipalPaid;
    prevInterestPaid = newInterestPaid;
  }

  return generated;
}
