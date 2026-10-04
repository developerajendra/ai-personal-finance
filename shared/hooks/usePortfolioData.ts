'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Investment, Loan, Property, BankBalance, PPFAccount } from '@/shared/types';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';
import { isSettledReceivable } from '@/shared/utils/receivables';

export interface PortfolioSnapshot {
  investments: Investment[];
  loans: Loan[];
  properties: Property[];
  bankBalances: BankBalance[];
  stocks: any[];
  mutualFunds: any[];
  ppfAccounts: PPFAccount[];
}

/**
 * Published portfolio + live holdings from /api/portfolio/snapshot, with the app's
 * canonical totals (moved here unchanged from PortfolioAnalytics so the sidebar,
 * Overview and Portfolio screens share one query cache).
 */
/** Stable empty list so memoised totals don't recompute every render while loading */
const EMPTY: never[] = [];

export function usePortfolioData() {
  const { data, isLoading } = useQuery<PortfolioSnapshot>({
    queryKey: ['portfolio-snapshot'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/snapshot');
      if (!response.ok) throw new Error('Failed to fetch portfolio snapshot');
      return response.json();
    },
  });

  // Closed records are history: the money now lives in another record, so nothing downstream counts them
  const allInvestments = data?.investments ?? (EMPTY as PortfolioSnapshot['investments']);
  const investments = useMemo(() => allInvestments.filter((inv) => inv.status !== 'closed'), [allInvestments]);
  const allLoans = data?.loans ?? (EMPTY as PortfolioSnapshot['loans']);
  const loans = useMemo(() => allLoans.filter((l) => l.status === 'active'), [allLoans]);
  const properties = data?.properties ?? (EMPTY as PortfolioSnapshot['properties']);
  const allBankBalances = data?.bankBalances ?? (EMPTY as PortfolioSnapshot['bankBalances']);
  // Paid receivables are history, not assets — the received money lives in another record now
  const bankBalances = useMemo(
    () => allBankBalances.filter((bb) => !isSettledReceivable(bb) && (bb.tags?.includes('receivable') || bb.status !== 'closed')),
    [allBankBalances]
  );
  const stocks = data?.stocks ?? (EMPTY as PortfolioSnapshot['stocks']);
  const mutualFunds = data?.mutualFunds ?? (EMPTY as PortfolioSnapshot['mutualFunds']);
  const ppfAccounts = data?.ppfAccounts ?? (EMPTY as PortfolioSnapshot['ppfAccounts']);

  const stocksData = useMemo(() => ({ stocks }), [stocks]);
  const mutualFundsData = useMemo(() => ({ mutualFunds }), [mutualFunds]);

  const activeInvestments = useMemo(
    () => investments.filter((inv) => inv.status !== 'closed'),
    [investments]
  );

  const totalInvestments = useMemo(
    () => activeInvestments.reduce((sum, inv) => sum + getCurrentInvestmentValue(inv), 0),
    [activeInvestments]
  );
  const totalLoans = useMemo(
    () => loans.reduce((sum, loan) => sum + loan.outstandingAmount, 0),
    [loans]
  );
  const totalProperties = useMemo(
    () => properties.reduce((sum, prop) => sum + (prop.currentValue || prop.purchasePrice), 0),
    [properties]
  );
  const totalStocks = useMemo(
    () => stocks.reduce((sum, stock) => sum + ((stock.last_price || 0) * (stock.quantity || 0)), 0),
    [stocks]
  );
  const totalMutualFunds = useMemo(
    () => mutualFunds.reduce((sum, mf) => sum + ((mf.last_price || 0) * (mf.quantity || 0)), 0),
    [mutualFunds]
  );
  const totalPPF = useMemo(
    () => ppfAccounts.reduce((sum, account) => sum + (account.grandTotal || 0), 0),
    [ppfAccounts]
  );
  const totalBankBalances = useMemo(
    () =>
      bankBalances
        .filter((bb: any) => !bb.tags?.includes('receivable'))
        .reduce((sum, bb) => sum + (bb.balance || 0), 0),
    [bankBalances]
  );

  // Calculate receivables - use expected total if available, otherwise use balance
  const totalReceivables = useMemo(
    () =>
      bankBalances
        .filter((bb: any) => bb.tags?.includes('receivable'))
        .reduce((sum, bb: any) => {
          if (bb.interestRate && bb.issueDate) {
            const principal = bb.balance || 0;
            const interestRate = bb.interestRate / 100;
            const issueDate = new Date(bb.issueDate);
            const dueDate = bb.dueDate ? new Date(bb.dueDate) : new Date();
            const daysDiff = Math.max(0, Math.floor((dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
            const years = daysDiff / 365;
            const interestAmount = principal * interestRate * years;
            return sum + (principal + interestAmount);
          }
          return sum + (bb.balance || 0);
        }, 0),
    [bankBalances]
  );

  const fixedAssetsFromInvestments = useMemo(
    () =>
      activeInvestments.reduce(
        (sum, inv) => sum + (inv.assetType === 'fixed' ? getCurrentInvestmentValue(inv) : 0),
        0
      ),
    [activeInvestments]
  );

  const fixedAssetsFromProperties = useMemo(
    () =>
      properties.reduce((sum, prop) => {
        const value = prop.currentValue || prop.purchasePrice || 0;
        return sum + (prop.assetType === 'liquid' ? 0 : value);
      }, 0),
    [properties]
  );

  const fixedAssetsFromBankBalances = useMemo(
    () =>
      bankBalances
        .filter((bb: any) => !bb.tags?.includes('receivable') && bb.assetType === 'fixed')
        .reduce((sum, bb) => sum + (bb.balance || 0), 0),
    [bankBalances]
  );

  const totalFixedAssets = fixedAssetsFromInvestments + fixedAssetsFromProperties + fixedAssetsFromBankBalances;

  const liquidAssetsFromInvestments = useMemo(
    () =>
      activeInvestments.reduce(
        (sum, inv) => sum + (inv.assetType === 'fixed' ? 0 : getCurrentInvestmentValue(inv)),
        0
      ),
    [activeInvestments]
  );

  const liquidAssetsFromProperties = useMemo(
    () =>
      properties.reduce((sum, prop) => {
        const value = prop.currentValue || prop.purchasePrice || 0;
        return sum + (prop.assetType === 'liquid' ? value : 0);
      }, 0),
    [properties]
  );

  const liquidAssetsFromBankBalances = useMemo(
    () =>
      bankBalances
        .filter((bb: any) => {
          if (bb.tags?.includes('receivable')) return true;
          return bb.assetType !== 'fixed';
        })
        .reduce((sum, bb: any) => {
          if (bb.tags?.includes('receivable')) {
            if (bb.interestRate && bb.issueDate) {
              const principal = bb.balance || 0;
              const interestRate = bb.interestRate / 100;
              const issueDate = new Date(bb.issueDate);
              const dueDate = bb.dueDate ? new Date(bb.dueDate) : new Date();
              const daysDiff = Math.max(0, Math.floor((dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
              const years = daysDiff / 365;
              const interestAmount = principal * interestRate * years;
              return sum + (principal + interestAmount);
            }
            return sum + (bb.balance || 0);
          }
          return sum + (bb.balance || 0);
        }, 0),
    [bankBalances]
  );

  const totalLiquidAssets =
    liquidAssetsFromInvestments +
    liquidAssetsFromProperties +
    totalStocks +
    totalMutualFunds +
    totalPPF +
    liquidAssetsFromBankBalances;

  const totalAssetsFromCategories = totalFixedAssets + totalLiquidAssets;
  const netWorth = totalAssetsFromCategories - totalLoans;

  if (process.env.NODE_ENV === 'development') {
    const totalAllAssets =
      totalInvestments + totalProperties + totalStocks + totalMutualFunds + totalPPF + totalBankBalances + totalReceivables;
    const difference = Math.abs(totalAllAssets - totalAssetsFromCategories);
    if (difference > 0.01) {
      console.warn('⚠️ Asset calculation mismatch detected:', {
        'Total All Assets (sum of all categories)': totalAllAssets,
        'Total from Fixed + Liquid': totalAssetsFromCategories,
        'Difference': difference,
      });
    }
  }

  return {
    totalInvestments,
    totalLoans,
    totalProperties,
    totalStocks,
    totalMutualFunds,
    totalPPF,
    totalBankBalances,
    totalReceivables,
    totalFixedAssets,
    totalLiquidAssets,
    netWorth,
    isLoading,
    investments,
    loans,
    properties,
    stocksData,
    mutualFundsData,
    ppfAccounts,
    bankBalances,
  };
}

