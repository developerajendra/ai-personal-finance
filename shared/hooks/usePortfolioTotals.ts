'use client';

import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Landmark, BadgeIndianRupee, TrendingUp, PiggyBank, Building2, HandCoins } from 'lucide-react';
import type { BankBalance, Investment } from '@/shared/types';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';
import { usePortfolioData } from '@/shared/hooks/usePortfolioData';
import { RETIREMENT_INVESTMENT_TYPES } from '@/shared/schemas/finance';

export type AssetClassKey = 'bank' | 'investments' | 'stocks' | 'pf' | 'property' | 'recv';

export interface AssetClass {
  key: AssetClassKey;
  label: string;
  href: string;
  icon: LucideIcon;
  /** CSS colour token for dots, bars and charts */
  color: string;
  value: number;
  count: number;
  note: string;
  /** share of total assets, 0–100 */
  share: number;
}

const isReceivable = (bb: BankBalance) => !!bb.tags?.includes('receivable');
const STOCK_TYPES: Investment['type'][] = ['stocks', 'mutual-fund'];
export const isRetirementInvestment = (i: Investment) => (RETIREMENT_INVESTMENT_TYPES as readonly string[]).includes(i.type);

/** Expected receivable amount: principal plus simple interest to the due date (same rule as usePortfolioData). */
export function receivableExpected(bb: BankBalance) {
  const principal = bb.balance || 0;
  if (!bb.interestRate || !bb.issueDate) return { principal, interest: 0, total: principal };
  const issue = new Date(bb.issueDate);
  const due = bb.dueDate ? new Date(bb.dueDate) : new Date();
  const days = Math.max(0, Math.floor((due.getTime() - issue.getTime()) / 864e5));
  const interest = principal * (bb.interestRate / 100) * (days / 365);
  return { principal, interest, total: principal + interest };
}

/** Days from today to an ISO date (negative = past). */
export function daysUntil(iso: string | undefined | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 864e5);
}

/**
 * Totals grouped into the design's six asset classes plus liabilities.
 * Built on usePortfolioData so it shares the ['portfolio-snapshot'] cache and its
 * canonical totals: assets − loans here equals usePortfolioData().netWorth.
 */
export function usePortfolioTotals() {
  const data = usePortfolioData();

  return useMemo(() => {
    const { investments, loans, properties, bankBalances, ppfAccounts, totalLoans, totalProperties, totalReceivables, totalBankBalances, totalPPF } = data;
    const stocks = data.stocksData.stocks ?? [];
    const funds = data.mutualFundsData.mutualFunds ?? [];

    const active = investments.filter((i) => i.status !== 'closed');
    const deposits = active.filter((i) => !isRetirementInvestment(i) && !STOCK_TYPES.includes(i.type));
    const manualMarket = active.filter((i) => STOCK_TYPES.includes(i.type));
    const retInv = active.filter(isRetirementInvestment);
    const cashAccounts = bankBalances.filter((b) => !isReceivable(b));
    const receivables = bankBalances.filter(isReceivable);

    const depVal = deposits.reduce((s, i) => s + getCurrentInvestmentValue(i), 0);
    const manualMarketVal = manualMarket.reduce((s, i) => s + getCurrentInvestmentValue(i), 0);
    const retInvVal = retInv.reduce((s, i) => s + getCurrentInvestmentValue(i), 0);
    const marketVal = data.totalStocks + data.totalMutualFunds + manualMarketVal;
    const unrealised = [...stocks, ...funds].reduce((s, h) => s + (h.pnl || 0), 0);
    const retirement = totalPPF + retInvVal;
    const banks = new Set(cashAccounts.map((b) => b.bankName)).size;

    const raw: Omit<AssetClass, 'share'>[] = [
      { key: 'bank', label: 'Cash & bank', href: '/portfolio/bank-balances', icon: Landmark, color: 'var(--c-cash)', value: totalBankBalances, count: cashAccounts.length, note: `${cashAccounts.length} account${cashAccounts.length === 1 ? '' : 's'} · ${banks} bank${banks === 1 ? '' : 's'}` },
      { key: 'stocks', label: 'Stocks & funds', href: '/portfolio/stocks', icon: TrendingUp, color: 'var(--c-stock)', value: marketVal, count: stocks.length + funds.length + manualMarket.length, note: `${stocks.length + funds.length + manualMarket.length} holdings` },
      { key: 'pf', label: 'Retirement', href: '/portfolio/provident-fund', icon: PiggyBank, color: 'var(--c-ret)', value: retirement, count: ppfAccounts.length + retInv.length, note: `${ppfAccounts.length + retInv.length} account${ppfAccounts.length + retInv.length === 1 ? '' : 's'}` },
      { key: 'property', label: 'Properties', href: '/portfolio/properties', icon: Building2, color: 'var(--c-prop)', value: totalProperties, count: properties.length, note: `${properties.length} propert${properties.length === 1 ? 'y' : 'ies'}` },
      { key: 'recv', label: 'Receivables', href: '/portfolio/receivables', icon: HandCoins, color: 'var(--c-recv)', value: totalReceivables, count: receivables.length, note: `${receivables.length} ${receivables.length === 1 ? 'person' : 'people'}` },
      { key: 'investments', label: 'Other investments', href: '/portfolio/investments', icon: BadgeIndianRupee, color: 'var(--c-dep)', value: depVal, count: deposits.length, note: `${deposits.length} investment${deposits.length === 1 ? '' : 's'} · deposits, bonds & more` },
    ];
    const assets = raw.reduce((s, c) => s + c.value, 0);
    const classes: AssetClass[] = raw.map((c) => ({ ...c, share: assets > 0 ? (c.value / assets) * 100 : 0 }));
    const byKey = Object.fromEntries(classes.map((c) => [c.key, c])) as Record<AssetClassKey, AssetClass>;

    return {
      ...data,
      classes,
      byKey,
      assets,
      liabilities: totalLoans,
      netWorth: assets - totalLoans,
      unrealised,
      deposits,
      /** Manually added retirement accounts (NPS, PF, other); EPFO passbook PF accounts are ppfAccounts */
      retirementInvestments: retInv,
      cashAccounts,
      receivables,
      stocks,
      funds,
      activeLoans: loans.filter((l) => l.status === 'active'),
      holdings: classes.reduce((s, c) => s + c.count, 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `data` is rebuilt each render; its inputs below are stable references
  }, [data.investments, data.loans, data.properties, data.bankBalances, data.stocksData, data.mutualFundsData, data.ppfAccounts, data.isLoading]);
}
