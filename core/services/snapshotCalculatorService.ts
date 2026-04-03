/**
 * Snapshot Calculator Service
 * Calculates financial snapshot values AS OF a specific date for accurate historical data.
 * Supports date-filtered investments (with ruleFormula), transactions, properties, and loans.
 */

import * as investmentRepo from "@/core/db/repositories/investmentRepository";
import * as loanRepo from "@/core/db/repositories/loanRepository";
import * as propertyRepo from "@/core/db/repositories/propertyRepository";
import * as bankBalanceRepo from "@/core/db/repositories/bankBalanceRepository";
import * as transactionRepo from "@/core/db/repositories/transactionRepository";
import * as stockRepo from "@/core/db/repositories/stockRepository";
import * as mutualFundRepo from "@/core/db/repositories/mutualFundRepository";
import * as ppfAccountRepo from "@/core/db/repositories/ppfAccountRepository";
import * as loanSnapshotRepo from "@/core/db/repositories/loanSnapshotRepository";
import { getInvestmentValueAtDate } from "@/core/utils/investmentValueCalculator";
import type {
  Investment,
  Loan,
  BankBalance,
  FinancialSnapshot,
} from "@/core/types";

async function getLoanOutstandingAtDate(userId: string, loan: Loan, asOfDate: Date): Promise<number> {
  const start = new Date(loan.startDate);
  if (asOfDate < start) return 0;
  if (loan.status !== "active") return 0;

  const asOfYear = asOfDate.getFullYear();
  const asOfMonth = asOfDate.getMonth() + 1;
  const snapshot = await loanSnapshotRepo.findByLoanAndMonth(userId, loan.id, asOfYear, asOfMonth);
  if (snapshot) {
    return snapshot.outstandingAmount;
  }

  const now = new Date();
  const daysDiff = Math.floor(
    (now.getTime() - asOfDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysDiff <= 45 && daysDiff >= -31) {
    const latest = await loanSnapshotRepo.findLatest(userId, loan.id);
    return latest ? latest.outstandingAmount : loan.outstandingAmount;
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

export async function calculateSnapshotAsOfDate(
  userId: string,
  year: number,
  month?: number
): Promise<Partial<FinancialSnapshot>> {
  const asOfDate =
    month !== undefined
      ? new Date(year, month, 0)
      : new Date(year, 11, 31);
  asOfDate.setHours(23, 59, 59, 999);

  const monthEnd = new Date(asOfDate.getTime());

  const [
    allInvestments,
    allLoans,
    allProperties,
    bankBalances,
    transactions,
    allStocks,
    allMutualFunds,
    ppfAccounts,
  ] = await Promise.all([
    investmentRepo.findByUserId(userId),
    loanRepo.findByUserId(userId),
    propertyRepo.findByUserId(userId),
    bankBalanceRepo.findByUserId(userId),
    transactionRepo.findByUserId(userId),
    stockRepo.findByUserId(userId),
    mutualFundRepo.findByUserId(userId),
    ppfAccountRepo.findByUserId(userId),
  ]);

  const filteredInvestments = allInvestments.filter((inv) => {
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

  const filteredLoans = allLoans.filter(
    (l) => l.isPublished && l.status === "active" && new Date(l.startDate) <= asOfDate
  );

  const loanOutstandingAmounts = await Promise.all(
    filteredLoans.map((loan) => getLoanOutstandingAtDate(userId, loan, asOfDate))
  );
  const totalLoans = loanOutstandingAmounts.reduce((sum, amount) => sum + amount, 0);

  const filteredProperties = allProperties.filter(
    (p) => p.isPublished && new Date(p.purchaseDate) <= asOfDate
  );
  const totalProperties = filteredProperties.reduce(
    (sum, p) => sum + (p.currentValue || p.purchasePrice || 0),
    0
  );

  const nonReceivableBalances = bankBalances.filter(
    (bb: BankBalance) => bb.isPublished && !bb.tags?.includes("receivable")
  );
  const totalBankBalances = nonReceivableBalances.reduce(
    (sum, bb) => sum + (bb.balance || 0),
    0
  );

  const receivableBalances = bankBalances.filter(
    (bb: BankBalance) => bb.isPublished && bb.tags?.includes("receivable")
  );
  const totalReceivables = receivableBalances.reduce(
    (sum, bb: BankBalance) => {
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

  const totalStocks =
    allStocks?.reduce(
      (sum, s) => sum + ((s.last_price || 0) * (s.quantity || 0)),
      0
    ) ?? 0;
  const totalMutualFunds =
    allMutualFunds?.reduce(
      (sum, m) => sum + ((m.last_price || 0) * (m.quantity || 0)),
      0
    ) ?? 0;
  const totalPPF = ppfAccounts.reduce((sum, a) => sum + (a.grandTotal || 0), 0);

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
    (bb: BankBalance) => bb.assetType === "fixed"
  );
  const fixedAssetsFromBankBalances = fixedBank.reduce(
    (sum, bb: BankBalance) => sum + (bb.balance || 0),
    0
  );

  const liquidBankFilter = bankBalances.filter(
    (bb: BankBalance) => {
      if (!bb.isPublished) return false;
      if (bb.tags?.includes("receivable")) return true;
      return bb.assetType !== "fixed";
    }
  );
  const liquidAssetsFromBankBalances = liquidBankFilter.reduce(
    (sum, bb: BankBalance) => {
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

  const loanBreakdown: Record<string, number> = {};
  for (let i = 0; i < filteredLoans.length; i++) {
    const loan = filteredLoans[i];
    const val = loanOutstandingAmounts[i];
    loanBreakdown[loan.type] = (loanBreakdown[loan.type] || 0) + val;
  }

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
