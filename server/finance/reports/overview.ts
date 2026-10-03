import "server-only";
import { loadMutualFunds, loadPortfolio, loadStocks } from "@/server/finance/portfolio/service";
import { loadPPFAccounts } from "@/server/finance/provident-fund/ppfStorage";
import { summarizeTransactions } from "@/server/finance/transactions/service";
import { sumMoney } from "@/shared/utils/money";

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
  const bankBalances = portfolio.bankBalances.filter((b) => b.isPublished && b.status !== "closed");

  const totalInvestments = sumMoney(investments.map((i) => i.amount));
  const totalLoans = sumMoney(loans.map((l) => l.outstandingAmount));
  const totalProperties = sumMoney(properties.map((p) => p.currentValue ?? p.purchasePrice));
  const totalBankBalances = sumMoney(bankBalances.map((b) => b.balance));
  const totalStocks = sumMoney(stocks.map((s) => s.last_price * s.quantity));
  const totalMutualFunds = sumMoney(mutualFunds.map((m) => m.last_price * m.quantity));
  const totalProvidentFund = sumMoney(ppfAccounts.map((p) => p.grandTotal));
  const totalAssets = sumMoney([
    totalInvestments, totalProperties, totalBankBalances, totalStocks, totalMutualFunds, totalProvidentFund,
  ]);

  return {
    currency: "INR",
    totals: {
      investments: totalInvestments,
      loansOutstanding: totalLoans,
      properties: totalProperties,
      bankBalances: totalBankBalances,
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
      stocks: stocks.length,
      mutualFunds: mutualFunds.length,
    },
    breakdown: {
      investmentsByType: groupSum(investments, (i) => i.type, (i) => i.amount),
      loansByType: groupSum(loans, (l) => l.type, (l) => l.outstandingAmount),
    },
    transactions: summarizeTransactions(portfolio.transactions),
  };
}
