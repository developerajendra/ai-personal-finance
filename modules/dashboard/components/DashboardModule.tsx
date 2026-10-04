'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFinancialData } from '@/shared/hooks/useFinancialData';
import { usePortfolioTotals, daysUntil } from '@/shared/hooks/usePortfolioTotals';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { buildCashEvents } from '@/shared/utils/upcoming';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';
import { assessCurrent, monthEnd, STALE_DAYS, type LoanStatement } from '@/shared/utils/netWorthHistory';
import {
  cashCover,
  cashFlowThisMonth,
  debtSummary,
  investmentSummary,
  liquidityTiers,
  rankAttention,
  subscriptionSummary,
  type Attention,
} from '@/shared/utils/dashboardInsights';
import { NetWorthPanel } from './NetWorthPanel';
import { useSubscriptions, inrPerCycle } from '@/modules/subscriptions/useSubscriptions';
import { useBudget, monthKey } from '@/modules/budget/useBudget';
import { fetchLoanSnapshots } from '@/modules/portfolio/components/LoanAnalyticsModule';
import {
  AllocationPanel,
  AttentionPanel,
  CashCard,
  CashFlowCard,
  CommitmentsPanel,
  DebtCard,
  FreshnessSummary,
  InvestmentCard,
  LiquidityPanel,
  SubscriptionsSummary,
} from './OverviewPanels';

/**
 * Dashboard: where things stand today — net worth, what needs attention, where the money sits and
 * how reachable it is, what is due, and how current the data is. Change over time lives in
 * Trends & analysis (/performance).
 */
export function DashboardModule() {
  const { transactions, isLoading: txLoading } = useFinancialData();
  const t = usePortfolioTotals();
  const { M } = useMoney();
  const [days, setDays] = useState<30 | 90>(30);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [t.isLoading]);

  // Same query key + fetch as the Portfolio page, so the cache is shared (broker connection status).
  const { data: stocksMeta } = useQuery<{ stocks: any[]; isAuthenticated?: boolean; fromCache?: boolean }>({
    queryKey: ['stocks'],
    queryFn: async () => {
      const response = await fetch('/api/zerodha/stocks');
      if (!response.ok) return { stocks: [] };
      return response.json();
    },
  });
  const marketLive = stocksMeta ? !!stocksMeta.isAuthenticated : undefined;

  // Lender statements give loan balances their effective date (same query as the Loans page)
  const { data: loanSnaps } = useQuery({ queryKey: ['loan-analytics-snapshots'], queryFn: fetchLoanSnapshots });
  const statements = useMemo(() => {
    const out: Record<string, LoanStatement> = {};
    for (const { snapshot: s } of loanSnaps?.snapshots ?? []) {
      const date = monthEnd(Number(s.year), Number(s.month));
      if (!out[s.loanId] || date > out[s.loanId]!.date) out[s.loanId] = { date, outstanding: s.outstandingAmount, emi: s.emiAmount };
    }
    return out;
  }, [loanSnaps]);

  const { items: budgetItems, isLoading: budgetLoading } = useBudget(monthKey());
  const { all: subscriptions, isLoading: subsLoading } = useSubscriptions();

  const market = t.byKey.stocks.value;
  const manualMarket = useMemo(() => t.investments.filter((i) => i.type === 'stocks' || i.type === 'mutual-fund'), [t.investments]);

  const quality = useMemo(
    () =>
      assessCurrent({
        cashAccounts: t.cashAccounts,
        loans: t.activeLoans,
        loanStatements: statements,
        properties: t.properties,
        ppfAccounts: t.ppfAccounts,
        marketValue: t.totalStocks + t.totalMutualFunds,
        marketLive,
        assets: t.assets,
        liabilities: t.liabilities,
        now,
      }),
    [t.cashAccounts, t.activeLoans, statements, t.properties, t.ppfAccounts, t.totalStocks, t.totalMutualFunds, marketLive, t.assets, t.liabilities, now],
  );

  const debt = useMemo(() => debtSummary(t.loans, now, statements), [t.loans, now, statements]);
  const cover = useMemo(
    () => cashCover({ cashAccounts: t.cashAccounts, budgetItems: budgetLoading ? null : budgetItems, loans: t.loans, now, staleDays: STALE_DAYS.bank }),
    [t.cashAccounts, budgetItems, budgetLoading, t.loans, now],
  );
  const inv = useMemo(() => investmentSummary({ stocks: t.stocks, funds: t.funds, manualMarket, marketLive }), [t.stocks, t.funds, manualMarket, marketLive]);
  const liquidity = useMemo(
    () =>
      liquidityTiers({
        cashAccounts: t.cashAccounts,
        deposits: t.deposits,
        marketValue: market,
        marketLive,
        retirement: t.byKey.pf.value,
        ppfAccounts: t.ppfAccounts,
        properties: t.properties,
        receivables: t.byKey.recv.value,
        now,
      }),
    [t.cashAccounts, t.deposits, market, marketLive, t.byKey, t.ppfAccounts, t.properties, now],
  );
  const subs = useMemo(() => subscriptionSummary(subscriptions, inrPerCycle, now, 30), [subscriptions, now]);
  const flow = useMemo(() => (txLoading ? null : cashFlowThisMonth(transactions, now)), [transactions, txLoading, now]);

  // EMIs (unknown amounts included, flagged), maturities, receivables, salary and renewals
  const events = useMemo(
    () => buildCashEvents({ loans: t.loans, investments: t.investments, bankBalances: t.bankBalances, transactions, subscriptions }, 4, { unverifiedEmis: true }),
    [t.loans, t.investments, t.bankBalances, transactions, subscriptions],
  );
  const inWindow = useMemo(() => events.upcoming.filter((e) => (daysUntil(e.date) ?? 999) <= days), [events.upcoming, days]);

  const largest = useMemo(() => {
    const candidates = [
      ...t.deposits.map((i) => ({ label: i.name, value: getCurrentInvestmentValue(i), href: i.type === 'fd' ? '/portfolio/fixed-deposits' : '/portfolio/investments' })),
      ...t.stocks.map((s: any) => ({ label: s.tradingsymbol, value: (s.last_price || 0) * (s.quantity || 0), href: '/portfolio/stocks' })),
      ...t.funds.map((f: any) => ({ label: f.fund_name || f.tradingsymbol, value: (f.last_price || 0) * (f.quantity || 0), href: '/portfolio/mutual-funds' })),
      ...manualMarket.map((i) => ({ label: i.name, value: getCurrentInvestmentValue(i), href: '/portfolio/stocks' })),
      ...t.ppfAccounts.map((p) => ({ label: `EPF · ${p.establishmentName || p.memberName || 'account'}`, value: p.grandTotal || 0, href: '/portfolio/provident-fund' })),
      ...t.cashAccounts.map((b) => ({ label: b.bankName, value: b.balance || 0, href: '/portfolio/bank-balances' })),
    ];
    return candidates.sort((a, b) => b.value - a.value)[0] ?? null;
  }, [t.deposits, t.stocks, t.funds, manualMarket, t.ppfAccounts, t.cashAccounts]);

  const attention = useMemo(() => {
    const items: Attention[] = [];
    // Tier 1 — overdue money
    for (const r of t.receivables) {
      const d = daysUntil(r.dueDate);
      if (d != null && d < 0 && !r.paidDate) {
        items.push({
          key: `recv-${r.id}`,
          tier: 1,
          title: `${r.bankName} owes ${M(r.balance)}`,
          reason: `Repayment was due ${fmtDate(r.dueDate)} — ${-d} days overdue.`,
          action: 'Follow up or record the repayment',
          href: '/portfolio/receivables',
          impact: r.balance || 0,
        });
      }
    }
    for (const e of events.overdue.filter((e) => e.kind === 'maturity')) {
      items.push({ key: e.id, tier: 1, title: `${e.title} not recorded`, reason: `${e.sub}. The money may be sitting uncounted or double-counted.`, action: 'Mark it received or reinvested', href: e.href, impact: e.amount });
    }
    // Tier 2 — records that make totals or commitments wrong
    for (const { loan, check } of debt.checks) {
      if (check.status === 'known') continue;
      const reason =
        check.status === 'unknown'
          ? 'No EMI is recorded, so monthly commitments and cash cover leave it out.'
          : check.status === 'implausible'
            ? `Recorded EMI ${M(loan.emiAmount)} is more than a monthly payment can be${check.expected ? ` (loan terms imply ≈ ${M(check.expected)})` : ''}; it is excluded from totals.`
            : `Recorded EMI ${M(loan.emiAmount)} differs from the ≈ ${M(check.expected)} its principal, rate and tenure imply.`;
      items.push({ key: `emi-${loan.id}`, tier: 2, title: `${loan.name}: EMI ${check.status === 'unknown' ? 'missing' : 'looks wrong'}`, reason, action: 'Check the lender statement and correct the loan', href: '/portfolio/loans', impact: loan.outstandingAmount });
    }
    for (const c of debt.statementConflicts) {
      items.push({
        key: `stmt-${c.loan.id}`,
        tier: 2,
        title: `${c.loan.name}: balance conflict`,
        reason: `Loan record says ${M(c.record)}; the latest statement (${fmtDate(c.date)}) says ${M(c.statement)}. Net worth uses the record.`,
        action: 'Confirm which is current and update the loan',
        href: '/portfolio/loans',
        impact: Math.abs(c.record - c.statement),
      });
    }
    for (const i of quality.issues) {
      if (!i.material || i.kind === 'estimated') continue;
      const connection = i.source === 'Stocks & funds';
      items.push({
        key: `q-${i.source}-${i.kind}`,
        tier: i.kind === 'missing' || connection ? 2 : 3,
        title: connection ? 'Broker not connected' : `${i.source}: ${i.kind === 'missing' ? 'missing data' : i.kind === 'undated' ? 'balance date unknown' : 'out of date'}`,
        reason: `${i.detail}${i.asOf ? ` (oldest ${fmtDate(i.asOf)})` : ''}${i.amount ? ` · ${M(i.amount)} affected` : ''}.`,
        action: connection ? 'Reconnect to refresh prices' : i.source === 'Loans' ? 'Fetch or upload the latest loan statement' : i.source === 'EPF' ? 'Upload a recent EPF passbook' : 'Update the balances',
        href: connection ? '/settings' : i.source === 'Loans' ? '/portfolio/loans' : i.source === 'EPF' ? '/portfolio/provident-fund' : '/portfolio/bank-balances',
        impact: i.amount,
      });
    }
    return rankAttention(items);
  }, [t.receivables, events.overdue, debt, quality.issues, M]);

  return (
    <div>
      <h1 className="sr-only">Dashboard</h1>

      {/* 1. Net worth */}
      <NetWorthPanel t={t} marketLive={marketLive} loanStatements={statements} />

      {/* 2. Needs attention (hidden when nothing is actionable) */}
      {attention.length > 0 && (
        <div className="mt-4">
          <AttentionPanel items={attention} />
        </div>
      )}

      {/* 3. Allocation + compact summaries */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <AllocationPanel classes={t.classes} assets={t.assets} largest={largest} marketValue={market} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <CashCard cover={cover} accounts={t.cashAccounts.length} />
          <DebtCard debt={debt} assets={t.assets} />
          <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2">
            <InvestmentCard inv={inv} period="period" />
          </div>
        </div>
      </div>

      {/* 4. Commitments + liquidity */}
      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <CommitmentsPanel events={inWindow} overdueCount={events.overdue.length} days={days} onDays={setDays} />
        <LiquidityPanel tiers={liquidity.tiers} receivables={liquidity.receivables} assets={t.assets} />
      </div>

      {/* 5. Subscriptions, data freshness, and cash flow when the records support it */}
      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <SubscriptionsSummary summary={subs} isLoading={subsLoading} />
        <FreshnessSummary sources={quality.sources} issues={quality.issues} />
        {flow?.status === 'ok' && <CashFlowCard flow={flow.flow} asOf={now} />}
      </div>
    </div>
  );
}
