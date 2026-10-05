import "server-only";
import { loadMutualFunds, loadPortfolio, loadStocks } from "@/server/finance/portfolio/service";
import { loadPPFAccounts } from "@/server/finance/provident-fund/ppfStorage";
import { summarizeTransactions } from "@/server/finance/transactions/service";
import { sumMoney } from "@/shared/utils/money";
import { getCurrentInvestmentValue } from "@/shared/utils/investmentValue";
import { isSettledReceivable, receivableExpected } from "@/shared/utils/receivables";

function groupSum<T>(items: T[], key: (t: T) => string, value: (t: T) => number): Record<string, number> {
  const groups = new Map<string, number[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), value(item)]);
  }
  return Object.fromEntries([...groups].map(([k, vs]) => [k, sumMoney(vs)]));
}

/**
 * Verified portfolio figures for one user, computed server-side from
 * published records. The AI explains these numbers; it never calculates them.
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
  // Same inclusion and valuation rules as the dashboard (usePortfolioData), so chat and web agree
  const published = portfolio.bankBalances.filter((b) => b.isPublished && !isSettledReceivable(b));
  const receivables = published.filter((b) => b.tags?.includes("receivable"));
  const bankBalances = published.filter((b) => !b.tags?.includes("receivable") && b.status !== "closed");

  const totalInvestments = sumMoney(investments.map(getCurrentInvestmentValue));
  const totalLoans = sumMoney(loans.map((l) => l.outstandingAmount));
  const totalProperties = sumMoney(properties.map((p) => p.currentValue || p.purchasePrice || 0));
  const totalBankBalances = sumMoney(bankBalances.map((b) => b.balance || 0));
  const totalReceivables = sumMoney(receivables.map((b) => receivableExpected(b).total));
  const totalStocks = sumMoney(stocks.map((s) => (s.last_price || 0) * (s.quantity || 0)));
  const totalMutualFunds = sumMoney(mutualFunds.map((m) => (m.last_price || 0) * (m.quantity || 0)));
  const totalProvidentFund = sumMoney(ppfAccounts.map((p) => p.grandTotal || 0));
  const totalAssets = sumMoney([
    totalInvestments, totalProperties, totalBankBalances, totalReceivables, totalStocks, totalMutualFunds, totalProvidentFund,
  ]);

  return {
    currency: "INR",
    totals: {
      investments: totalInvestments,
      loansOutstanding: totalLoans,
      properties: totalProperties,
      bankBalances: totalBankBalances,
      receivables: totalReceivables,
      stocks: totalStocks,
      mutualFunds: totalMutualFunds,
      providentFund: totalProvidentFund,
      assets: totalAssets,
      netWorth: sumMoney([totalAssets, -totalLoans]),
    },
    counts: {
      investments: investments.length,
      loans: loans.length,
      properties: properties.length,
      bankAccounts: bankBalances.length,
      receivables: receivables.length,
      stocks: stocks.length,
      mutualFunds: mutualFunds.length,
    },
    breakdown: {
      investmentsByType: groupSum(investments, (i) => i.type, getCurrentInvestmentValue),
      loansByType: groupSum(loans, (l) => l.type, (l) => l.outstandingAmount),
    },
    transactions: summarizeTransactions(portfolio.transactions),
  };
}
