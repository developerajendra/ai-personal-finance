'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, TrendingUp, PiggyBank, CreditCard } from 'lucide-react';
import { useFinancialData } from '@/shared/hooks/useFinancialData';
import { usePortfolioTotals, daysUntil } from '@/shared/hooks/usePortfolioTotals';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { LinkButton, PageHeader } from '@/shared/components/ui';
import { buildCashEvents } from '@/shared/utils/upcoming';
import { healthChecks, liquidityLadder, monthlyFlows, referenceMonth } from '@/shared/utils/insights';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';
import { NetWorthPanel } from './NetWorthPanel';
import { SubscriptionsCard } from '@/modules/subscriptions/components/SubscriptionsModule';
import { useSubscriptions } from '@/modules/subscriptions/useSubscriptions';
import {
  AllocationPanel,
  AttentionPanel,
  BalanceSheetPanel,
  FreshnessPanel,
  HealthPanel,
  LadderPanel,
  NextDaysPanel,
  StatCard,
  freshness,
  type AttentionItem,
  type FreshnessRow,
} from './OverviewPanels';

const latest = (dates: (string | undefined | null)[]) => dates.filter(Boolean).sort().pop() ?? null;
const oldest = (dates: (string | undefined | null)[]) => dates.filter(Boolean).sort()[0] ?? null;

export function DashboardModule() {
  const { transactions, isLoading: txLoading } = useFinancialData();
  const t = usePortfolioTotals();
  const { M, S } = useMoney();

  // Same query key + fetch as the Portfolio page, so the cache is shared (used for freshness only).
  const { data: stocksMeta } = useQuery<{ stocks: any[]; isAuthenticated?: boolean; fromCache?: boolean }>({
    queryKey: ['stocks'],
    queryFn: async () => {
      const response = await fetch('/api/zerodha/stocks');
      if (!response.ok) return { stocks: [] };
      return response.json();
    },
  });

  const flows = useMemo(() => monthlyFlows(transactions), [transactions]);
  const ref = referenceMonth(flows);
  const { active: subscriptions } = useSubscriptions();
  const events = useMemo(
    () => buildCashEvents({ loans: t.loans, investments: t.investments, bankBalances: t.bankBalances, transactions, subscriptions }, 3),
    [t.loans, t.investments, t.bankBalances, transactions, subscriptions],
  );

  const cash = t.byKey.bank.value;
  const market = t.byKey.stocks.value;
  const retirement = t.byKey.pf.value;
  const property = t.byKey.property.value;
  const receivables = t.byKey.recv.value;
  const emi = t.activeLoans.reduce((s, l) => s + (l.emiAmount || 0), 0);
  const mainLoan = [...t.activeLoans].sort((a, b) => b.outstandingAmount - a.outstandingAmount)[0];

  const largest = useMemo(() => {
    const candidates = [
      ...t.deposits.map((i) => ({ label: i.name, value: getCurrentInvestmentValue(i) })),
      ...t.stocks.map((s: any) => ({ label: s.tradingsymbol, value: (s.last_price || 0) * (s.quantity || 0) })),
      ...t.funds.map((f: any) => ({ label: f.fund_name || f.tradingsymbol, value: (f.last_price || 0) * (f.quantity || 0) })),
      ...t.ppfAccounts.map((p) => ({ label: `EPF · ${p.establishmentName || p.memberName || 'account'}`, value: p.grandTotal || 0 })),
      ...t.cashAccounts.map((b) => ({ label: b.bankName, value: b.balance || 0 })),
    ];
    return candidates.sort((a, b) => b.value - a.value)[0] ?? null;
  }, [t.deposits, t.stocks, t.funds, t.ppfAccounts, t.cashAccounts]);

  const checks = useMemo(
    () => healthChecks({ cash, assets: t.assets, netWorth: t.netWorth, liabilities: t.liabilities, market, property, receivables, loans: t.loans, ref, largest }),
    [cash, t.assets, t.netWorth, t.liabilities, market, property, receivables, t.loans, ref, largest],
  );

  const rungs = useMemo(
    () => liquidityLadder({ cashAccounts: t.cashAccounts, deposits: t.deposits, marketValue: market, retirement, property, receivables }),
    [t.cashAccounts, t.deposits, market, retirement, property, receivables],
  );

  const emergencyMonths = ref && ref.expenses > 0 ? cash / ref.expenses : null;

  const attention = useMemo(() => {
    const items: AttentionItem[] = [];
    for (const r of t.receivables) {
      const d = daysUntil(r.dueDate);
      if (d != null && d < 0 && !r.paidDate) {
        items.push({ key: `r-${r.id}`, title: `${r.bankName} owes ${M(r.balance)}`, body: `Overdue · ${-d} days · due ${fmtDate(r.dueDate)}`, tone: 'loss', href: '/portfolio/receivables' });
      }
    }
    for (const l of t.activeLoans) {
      const age = (Date.now() - new Date(l.updatedAt).getTime()) / 864e5;
      if (age > 60) items.push({ key: `l-${l.id}`, title: `${l.name} data is ${Math.round(age)} days old`, body: 'Fetch the latest quarterly summary so liabilities reflect recent repayments.', tone: 'warn', href: '/portfolio/loans' });
    }
    if (emergencyMonths != null && emergencyMonths < 6) {
      items.push({ key: 'emergency', title: `Emergency cover is ${emergencyMonths.toFixed(1)} months`, body: `Below the 6-month target · topping cash up needs about ${M((6 - emergencyMonths) * (ref?.expenses ?? 0))}.`, tone: 'warn', href: '/portfolio/bank-balances' });
    }
    for (const e of events.overdue.filter((e) => e.id.startsWith('mat-'))) {
      items.push({ key: e.id, title: `${e.title} not recorded`, body: `${e.sub} — mark it received or reinvested.`, tone: 'neutral', href: e.href });
    }
    return items.slice(0, 5);
  }, [t.receivables, t.activeLoans, emergencyMonths, events.overdue, ref, M]);

  const freshRows: FreshnessRow[] = useMemo(() => {
    const ppfDate = latest(t.ppfAccounts.map((p) => p.lastUpdated || p.extractedAt));
    const bankOld = oldest(t.cashAccounts.map((b) => b.lastUpdated));
    const loanDate = latest(t.loans.map((l) => l.updatedAt));
    const propDate = latest(t.properties.map((p) => p.updatedAt));
    const zerodha = stocksMeta?.isAuthenticated ? { status: 'Live', tone: 'gain' as const } : { status: 'Cached', tone: 'warn' as const };
    return [
      { label: 'Stocks & mutual funds', source: 'Zerodha', ...zerodha, when: stocksMeta?.isAuthenticated ? 'Connected' : 'Not authenticated' },
      { label: 'Bank balances', source: 'Manual entry', ...freshness(bankOld, 60), when: bankOld ? `Oldest ${fmtDate(bankOld)}` : '—' },
      { label: 'Loans', source: 'Quarterly email', ...freshness(loanDate, 95) },
      { label: 'Provident fund', source: 'EPFO passbook upload', ...freshness(ppfDate, 60) },
      { label: 'Property values', source: 'Owner estimate', status: 'Estimate', tone: 'neutral' as const, when: propDate ? fmtDate(propDate) : '—' },
    ];
  }, [t.ppfAccounts, t.cashAccounts, t.loans, t.properties, stocksMeta]);

  const upcoming90 = events.upcoming.filter((e) => (daysUntil(e.date) ?? 999) <= 90);

  return (
    <div>
      <PageHeader
        title="Overview"
        actions={<LinkButton href="/transactions">Add transaction</LinkButton>}
        meta={<>{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(',', '')} · market prices cached</>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <NetWorthPanel netWorth={t.netWorth} isLoading={t.isLoading} />
        <AllocationPanel classes={t.classes} assets={t.assets} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Available cash"
          value={M(cash)}
          sub={emergencyMonths != null ? `${emergencyMonths.toFixed(1)} months of spending · target 6` : `${t.cashAccounts.length} accounts`}
          subTone={emergencyMonths != null && emergencyMonths < 6 ? 'warn' : 'muted'}
          href="/portfolio/bank-balances"
        />
        <StatCard
          icon={TrendingUp}
          label="Market investments"
          value={M(market)}
          sub={`${t.unrealised >= 0 ? '▲' : '▼'} ${S(t.unrealised)} unrealised`}
          subTone={t.unrealised >= 0 ? 'gain' : 'loss'}
          href="/portfolio/stocks"
        />
        <StatCard icon={PiggyBank} label="Retirement" value={M(retirement)} sub="EPF + PPF · locked until eligible" href="/portfolio/provident-fund" />
        <StatCard
          icon={CreditCard}
          label="Debt"
          value={M(t.liabilities)}
          sub={mainLoan ? `EMI ${M(emi)}/mo · ${mainLoan.interestRate}%` : 'No active loans'}
          href="/portfolio/loans"
        />
      </div>

      <div className="mt-4">
        <SubscriptionsCard />
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <HealthPanel checks={txLoading ? [] : checks} />
        <AttentionPanel items={attention} />
        <LadderPanel rungs={rungs} assets={t.assets} />
        <NextDaysPanel overdue={events.overdue} upcoming={upcoming90} />
        <BalanceSheetPanel classes={t.classes} assets={t.assets} liabilities={t.liabilities} netWorth={t.netWorth} />
        <FreshnessPanel rows={freshRows} />
      </div>
    </div>
  );
}
