import "server-only";
import { loadMutualFunds, loadPortfolio, loadStocks } from "@/server/finance/portfolio/service";
import { loadPPFAccounts } from "@/server/finance/provident-fund/ppfStorage";
import { summarizeTransactions } from "@/server/finance/transactions/service";
import { sumMoney } from "@/shared/utils/money";
import { getCurrentInvestmentValue } from "@/shared/utils/investmentValue";
import { isSettledReceivable, receivableExpected } from "@/shared/utils/receivables";
import { RETIREMENT_INVESTMENT_TYPES } from "@/shared/schemas/finance";

function groupSum<T>(items: T[], key: (t: T) => string, value: (t: T) => number): Record<string, number> {
  const groups = new Map<string, number[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), value(item)]);
  }
  return Object.fromEntries([...groups].map(([k, vs]) => [k, sumMoney(vs)]));
}

const MARKET_TYPES = ["stocks", "mutual-fund"];
const isRetirement = (type: string) => (RETIREMENT_INVESTMENT_TYPES as readonly string[]).includes(type);

/**
 * Verified portfolio figures for one user, computed server-side from
 * published records. The AI explains these numbers; it never calculates them.
 * Follows the same rules as the dashboard (usePortfolioData + usePortfolioTotals)
 * so the assistant's net worth matches the portal to the rupee.
 */
export async function getPortfolioOverview(userId: string) {
  const [portfolio, stocks, mutualFunds, ppfAccounts] = await Promise.all([
    loadPortfolio(userId),
    loadStocks(userId),
    loadMutualFunds(userId),
    loadPPFAccounts(userId),
  ]);
  const investments = portfolio.investments.filter((i) => i.isPublished && i.status !== "closed");
  const loans = portfolio.loans.filter((l) => l.isPublished && l.status === "active");
  const properties = portfolio.properties.filter((p) => p.isPublished);
  // Paid receivables are history; open receivables count even if their row is marked closed
  const published = portfolio.bankBalances.filter(
    (b) => b.isPublished && !isSettledReceivable(b) && (b.tags?.includes("receivable") || b.status !== "closed")
  );
  const bankAccounts = published.filter((b) => !b.tags?.includes("receivable"));
  const receivables = published.filter((b) => b.tags?.includes("receivable"));

  const value = (i: (typeof investments)[number]) => getCurrentInvestmentValue(i);
  const fixedDeposits = investments.filter((i) => i.type === "fd");
  const marketRecords = investments.filter((i) => MARKET_TYPES.includes(i.type));
  const retirementRecords = investments.filter((i) => isRetirement(i.type));
  const otherInvestments = investments.filter(
    (i) => i.type !== "fd" && !MARKET_TYPES.includes(i.type) && !isRetirement(i.type)
  );

  const totalStocks = sumMoney(stocks.map((s) => (s.last_price || 0) * (s.quantity || 0)));
  const totalMutualFunds = sumMoney(mutualFunds.map((m) => (m.last_price || 0) * (m.quantity || 0)));
  const totalEpfPassbooks = sumMoney(ppfAccounts.map((p) => p.grandTotal || 0));

  const classes = {
    cashAndBank: sumMoney(bankAccounts.map((b) => b.balance || 0)),
    stocksAndFunds: sumMoney([totalStocks, totalMutualFunds, ...marketRecords.map(value)]),
    retirement: sumMoney([totalEpfPassbooks, ...retirementRecords.map(value)]),
    properties: sumMoney(properties.map((p) => p.currentValue || p.purchasePrice || 0)),
    receivables: sumMoney(receivables.map((r) => receivableExpected(r).total)),
    fixedDeposits: sumMoney(fixedDeposits.map(value)),
    otherInvestments: sumMoney(otherInvestments.map(value)),
  };
  const totalAssets = sumMoney(Object.values(classes));
  const totalLoans = sumMoney(loans.map((l) => l.outstandingAmount));

  return {
    currency: "INR",
    note:
      "assets = sum of assetClasses (investments at current value per their growth rule, receivables with accrued interest). " +
      "netWorth = assets − loansOutstanding, and it already includes receivables. These are the same figures the dashboard shows.",
    totals: {
      assets: totalAssets,
      loansOutstanding: totalLoans,
      netWorth: sumMoney([totalAssets, -totalLoans]),
    },
    assetClasses: classes,
    holdings: {
      zerodhaStocks: totalStocks,
      zerodhaMutualFunds: totalMutualFunds,
      epfPassbooks: totalEpfPassbooks,
    },
    counts: {
      bankAccounts: bankAccounts.length,
      receivables: receivables.length,
      fixedDeposits: fixedDeposits.length,
      otherInvestments: otherInvestments.length,
      retirementAccounts: ppfAccounts.length + retirementRecords.length,
      properties: properties.length,
      loans: loans.length,
      stocks: stocks.length,
      mutualFunds: mutualFunds.length,
    },
    breakdown: {
      investmentsByType: groupSum(investments, (i) => i.type, value),
      loansByType: groupSum(loans, (l) => l.type, (l) => l.outstandingAmount),
    },
    transactions: summarizeTransactions(portfolio.transactions),
  };
}
