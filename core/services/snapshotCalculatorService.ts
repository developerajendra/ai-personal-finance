/**
 * Snapshot Calculator Service
 * Calculates financial snapshot values AS OF a specific date for accurate historical data.
 * Supports date-filtered investments (with ruleFormula), transactions, properties, and loans.
 */

import { loadFromJson } from "./jsonStorageService";
import { loadStocks, loadMutualFunds } from "./jsonStorageService";
import { PPFAccount, loadPPFAccounts } from "./ppfStorageService";
import { getInvestmentValueAtDate } from "@/core/utils/investmentValueCalculator";
import {
  getEffectiveOutstandingAmount,
  getLoanSnapshot,
} from "./loanAnalyticsService";
import type {
  Investment,
  Loan,
  Property,
  BankBalance,
  Transaction,
} from "@/core/types";
import type { FinancialSnapshot } from "@/core/types";

/**
 * Get loan outstanding at a given date.
 * - For snapshots with matching loan analytics data: use snapshot.outstandingAmount.
 * - For "current" month (asOf within 45 days of today): use effective outstanding
 *   (latest loan snapshot) to match Dashboard and /portfolio/loans.
 * - For older snapshots without analytics: use linear principal repayment approximation.
 */
function getLoanOutstandingAtDate(loan: Loan, asOfDate: Date): number {
  const start = new Date(loan.startDate);
  if (asOfDate < start) return 0;
  if (loan.status !== "active") return 0;

  const asOfYear = asOfDate.getFullYear();
  const asOfMonth = asOfDate.getMonth() + 1;
  const snapshot = getLoanSnapshot(loan.id, asOfYear, asOfMonth);
  if (snapshot) {
    return snapshot.outstandingAmount;
  }

  const now = new Date();
  const daysDiff = Math.floor(
    (now.getTime() - asOfDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysDiff <= 45 && daysDiff >= -31) {
    return getEffectiveOutstandingAmount(loan);
  }

  const monthsElapsed = Math.max(
    0,
    (asOfDate.getFullYear() - start.getFullYear()) * 12 +
      (asOfDate.getMonth() - start.getMonth())
  );
  const tenureMonths = Math.max(1, loan.tenureMonths);
  if (monthsElapsed >= tenureMonths) return 0;

  const remaining =
    loan.principalAmount * (1 - monthsElapsed / tenureMonths);
  return Math.max(0, Math.round(remaining * 100) / 100);
}

/**
 * Calculate financial snapshot as of end of given year/month
 */
export function calculateSnapshotAsOfDate(
  year: number,
  month?: number
): Partial<FinancialSnapshot> {
  const asOfDate =
    month !== undefined
      ? new Date(year, month, 0) // Last day of month (0 = previous month's last day)
      : new Date(year, 11, 31);
  asOfDate.setHours(23, 59, 59, 999);

  const monthEnd = new Date(asOfDate.getTime());

  const investments = loadFromJson<Investment>("investments");
  const loans = loadFromJson<Loan>("loans");
  const properties = loadFromJson<Property>("properties");
  const bankBalances = loadFromJson<BankBalance>("bankBalances");
  const transactions = loadFromJson<Transaction>("transactions");
  const stocks = loadStocks();
  const mutualFunds = loadMutualFunds();
  const ppfAccounts = loadPPFAccounts();

  // Filter investments: active at asOfDate (startDate <= asOf, exclude if closed before asOf)
  const filteredInvestments = investments.filter((inv) => {
    if (!inv.isPublished) return false;
    if (inv.status === "closed") {
      const closedDate = inv.endDate || inv.maturityDate || inv.updatedAt;
      if (closedDate && new Date(closedDate) <= asOfDate) return false;
    }
    return new Date(inv.startDate) <= asOfDate;
  });

  const totalInvestments = filteredInvestments.reduce(
    (sum, inv) => sum + getInvestmentValueAtDate(inv, asOfDate),
    0
  );

  // Filter and sum loans
  const filteredLoans = loans.filter(
    (l) => l.isPublished && l.status === "active" && new Date(l.startDate) <= asOfDate
  );
  const totalLoans = filteredLoans.reduce(
    (sum, loan) => sum + getLoanOutstandingAtDate(loan, asOfDate),
    0
  );

  // Filter properties: purchased before asOfDate
  const filteredProperties = properties.filter(
    (p) =>
      p.isPublished &&
      new Date(p.purchaseDate) <= asOfDate
  );
  const totalProperties = filteredProperties.reduce(
    (sum, p) => sum + (p.currentValue || p.purchasePrice || 0),
    0
  );

  // Bank balances: use current (no historical balance data)
  const nonReceivableBalances = bankBalances.filter(
    (bb: BankBalance & { tags?: string[] }) =>
      bb.isPublished && !bb.tags?.includes("receivable")
  );
  const totalBankBalances = nonReceivableBalances.reduce(
    (sum, bb) => sum + (bb.balance || 0),
    0
  );

  const receivableBalances = bankBalances.filter(
    (bb: BankBalance & { tags?: string[] }) =>
      bb.isPublished && bb.tags?.includes("receivable")
  );
  const totalReceivables = receivableBalances.reduce(
    (sum, bb: BankBalance & { interestRate?: number; issueDate?: string; dueDate?: string }) => {
      if (bb.interestRate && bb.issueDate) {
        const principal = bb.balance || 0;
        const issueDate = new Date(bb.issueDate);
        const dueDate = bb.dueDate ? new Date(bb.dueDate) : monthEnd;
        const daysDiff = Math.max(
          0,
          Math.floor((dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        const years = daysDiff / 365;
        return sum + principal * (1 + (bb.interestRate / 100) * Math.min(years, 10));
      }
      return sum + (bb.balance || 0);
    },
    0
  );

  // Stocks, MF, PPF: use current values (no historical price data available)
  const totalStocks =
    stocks?.reduce(
      (sum: number, s: { last_price?: number; quantity?: number }) =>
        sum + ((s.last_price || 0) * (s.quantity || 0)),
      0
    ) ?? 0;
  const totalMutualFunds =
    mutualFunds?.reduce(
      (sum: number, m: { last_price?: number; quantity?: number }) =>
        sum + ((m.last_price || 0) * (m.quantity || 0)),
      0
    ) ?? 0;
  const totalPPF = ppfAccounts.reduce((sum, a) => sum + (a.grandTotal || 0), 0);

  // Fixed vs Liquid assets
  const fixedAssetsFromInvestments = filteredInvestments
    .filter((inv) => inv.assetType === "fixed")
    .reduce((sum, inv) => sum + getInvestmentValueAtDate(inv, asOfDate), 0);
  const liquidAssetsFromInvestments = filteredInvestments
    .filter((inv) => inv.assetType !== "fixed")
    .reduce((sum, inv) => sum + getInvestmentValueAtDate(inv, asOfDate), 0);

  const fixedAssetsFromProperties = filteredProperties
    .filter((p) => p.assetType !== "liquid")
    .reduce((sum, p) => sum + (p.currentValue || p.purchasePrice || 0), 0);
  const liquidAssetsFromProperties = filteredProperties
    .filter((p) => p.assetType === "liquid")
    .reduce((sum, p) => sum + (p.currentValue || p.purchasePrice || 0), 0);

  const fixedBank = nonReceivableBalances.filter(
    (bb: BankBalance & { assetType?: string }) => bb.assetType === "fixed"
  );
  const fixedAssetsFromBankBalances = fixedBank.reduce(
    (sum: number, bb: BankBalance) => sum + (bb.balance || 0),
    0
  );

  const liquidBankFilter = bankBalances.filter(
    (bb: BankBalance & { tags?: string[]; assetType?: string }) => {
      if (!bb.isPublished) return false;
      if (bb.tags?.includes("receivable")) return true;
      return bb.assetType !== "fixed";
    }
  );
  const liquidAssetsFromBankBalances = liquidBankFilter.reduce(
    (sum: number, bb: BankBalance & { tags?: string[]; interestRate?: number; issueDate?: string; dueDate?: string }) => {
      if (bb.tags?.includes("receivable")) {
        if (bb.interestRate && bb.issueDate) {
          const principal = bb.balance || 0;
          const issueDate = new Date(bb.issueDate);
          const dueDate = bb.dueDate ? new Date(bb.dueDate) : monthEnd;
          const daysDiff = Math.max(
            0,
            Math.floor((dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24))
          );
          const years = daysDiff / 365;
          return sum + principal * (1 + (bb.interestRate / 100) * Math.min(years, 10));
        }
        return sum + (bb.balance || 0);
      }
      return sum + (bb.balance || 0);
    },
    0
  );

  const totalFixedAssets =
    fixedAssetsFromInvestments + fixedAssetsFromProperties + fixedAssetsFromBankBalances;
  const totalLiquidAssets =
    liquidAssetsFromInvestments +
    liquidAssetsFromProperties +
    totalStocks +
    totalMutualFunds +
    totalPPF +
    liquidAssetsFromBankBalances;

  const netWorth = totalFixedAssets + totalLiquidAssets - totalLoans;

  // Filter transactions by date <= end of snapshot month
  const refMonth = month ?? 12;
  const lastDay = new Date(year, refMonth, 0).getDate();
  const monthEndStr = `${year}-${String(refMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;
  const filteredTransactions = transactions.filter(
    (t) => new Date(t.date) <= new Date(monthEndStr)
  );

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = filteredTransactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;

  // Breakdowns
  const investmentBreakdown = filteredInvestments.reduce(
    (acc, inv) => {
      const val = getInvestmentValueAtDate(inv, asOfDate);
      acc[inv.type] = (acc[inv.type] || 0) + val;
      return acc;
    },
    {} as Record<string, number>
  );
  if (totalStocks > 0) {
    investmentBreakdown["stocks"] = (investmentBreakdown["stocks"] || 0) + totalStocks;
  }
  if (totalMutualFunds > 0) {
    investmentBreakdown["mutual-fund"] =
      (investmentBreakdown["mutual-fund"] || 0) + totalMutualFunds;
  }
  if (totalPPF > 0) {
    investmentBreakdown["provident-fund"] =
      (investmentBreakdown["provident-fund"] || 0) + totalPPF;
  }

  const loanBreakdown = filteredLoans.reduce(
    (acc, loan) => {
      const val = getLoanOutstandingAtDate(loan, asOfDate);
      acc[loan.type] = (acc[loan.type] || 0) + val;
      return acc;
    },
    {} as Record<string, number>
  );

  const propertyBreakdown = filteredProperties.reduce(
    (acc, p) => {
      const val = p.currentValue || p.purchasePrice || 0;
      acc[p.type] = (acc[p.type] || 0) + val;
      return acc;
    },
    {} as Record<string, number>
  );

  const categoryBreakdown = filteredTransactions.reduce(
    (acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    totalInvestments,
    totalLoans,
    totalProperties,
    totalBankBalances,
    totalReceivables,
    totalStocks,
    totalMutualFunds,
    totalPPF,
    totalFixedAssets,
    totalLiquidAssets,
    netWorth,
    totalIncome,
    totalExpenses,
    netBalance,
    investmentBreakdown,
    loanBreakdown,
    propertyBreakdown,
    categoryBreakdown,
  };
}

/**
 * Validate snapshot column consistency (totalFixedAssets + totalLiquidAssets - totalLoans ≈ netWorth)
 */
export function validateSnapshot(snapshot: FinancialSnapshot): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const tolerance = 0.01;

  const assetsSum = snapshot.totalFixedAssets + snapshot.totalLiquidAssets;
  const expectedNetWorth = assetsSum - snapshot.totalLoans;
  if (Math.abs(snapshot.netWorth - expectedNetWorth) > tolerance) {
    errors.push(
      `Net worth mismatch: ${snapshot.netWorth} vs expected ${expectedNetWorth} (assets ${assetsSum} - loans ${snapshot.totalLoans})`
    );
  }

  const investmentBreakdownSum = Object.values(
    snapshot.investmentBreakdown || {}
  ).reduce((a, b) => a + b, 0);
  const investmentsTotal =
    snapshot.totalInvestments +
    snapshot.totalStocks +
    snapshot.totalMutualFunds +
    snapshot.totalPPF;
  if (Math.abs(investmentBreakdownSum - investmentsTotal) > tolerance) {
    errors.push(
      `Investment breakdown sum ${investmentBreakdownSum} vs combined total ${investmentsTotal}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
