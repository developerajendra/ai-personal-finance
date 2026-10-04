'use client';

import { useState, type ReactNode } from 'react';
import { PageHeader, Segmented, type HeroMeta } from '@/shared/components/ui';
import { usePortfolioTotals, daysUntil, type AssetClassKey } from '@/shared/hooks/usePortfolioTotals';
import { useMoney, pct, fmtDate } from '@/shared/hooks/useMoney';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';
import { StocksDashboard } from './StocksDashboard';
import { MutualFundsDashboard } from './MutualFundsDashboard';
import { BarsPanel, DonutPanel, toSlices } from './ClassCharts';

const latest = (dates: (string | undefined | null)[]) => dates.filter(Boolean).sort().pop() ?? null;

/**
 * Asset-class page header: crumbs Portfolio › class, hero value, metadata chips
 * and a freshness note — all computed from the shared portfolio snapshot.
 */
export function ClassHeader({ classKey, actions, crumbs }: { classKey: AssetClassKey; actions?: ReactNode; crumbs?: { label: string; href?: string }[] }) {
  const t = usePortfolioTotals();
  const { M, S } = useMoney();
  const c = t.byKey[classKey];
  let metas: HeroMeta[] = [];
  let note: ReactNode = null;

  switch (classKey) {
    case 'bank': {
      const banks = new Set(t.cashAccounts.map((b) => b.bankName)).size;
      const foreign = t.cashAccounts.filter((b) => (b.originalCurrency || b.currency) && (b.originalCurrency || b.currency) !== 'INR').length;
      metas = [
        { label: 'Accounts', value: t.cashAccounts.length },
        { label: 'Banks', value: banks },
        { label: 'Foreign currency', value: foreign ? `${foreign} account${foreign === 1 ? '' : 's'}` : 'None' },
        { label: 'Share of assets', value: pct(c.share) },
      ];
      const oldest = t.cashAccounts.map((b) => b.lastUpdated).filter(Boolean).sort()[0];
      note = oldest ? `Oldest balance updated ${fmtDate(oldest)}` : null;
      break;
    }
    case 'investments': {
      const principal = t.deposits.reduce((s, i) => s + (i.amount || 0), 0);
      const maturing = t.deposits.filter((i) => {
        const d = daysUntil(i.maturityDate);
        return d != null && d >= 0 && d <= 365;
      }).length;
      const matured = t.deposits.filter((i) => (daysUntil(i.maturityDate) ?? 1) < 0).length;
      metas = [
        { label: 'Records', value: t.deposits.length },
        { label: 'Principal', value: M(principal) },
        { label: 'Accrued', value: S(c.value - principal), tone: c.value - principal >= 0 ? 'gain' : 'loss' },
        { label: 'Maturing in 12 months', value: maturing },
        ...(matured ? [{ label: 'Matured · payout pending', value: matured, tone: 'warn' as const }] : []),
      ];
      note = 'Values follow each record’s growth rule';
      break;
    }
    case 'pf': {
      const valueOf = (type: string) => t.retirementInvestments.filter((i) => i.type === type).reduce((s, i) => s + getCurrentInvestmentValue(i), 0);
      const pfCount = t.ppfAccounts.length + t.retirementInvestments.filter((i) => i.type === 'epf').length;
      const npsCount = t.retirementInvestments.filter((i) => i.type === 'nps').length;
      const otherCount = t.retirementInvestments.length - npsCount - (pfCount - t.ppfAccounts.length);
      const otherVal = valueOf('retirement-other');
      metas = [
        { label: 'Provident fund', value: M(t.totalPPF + valueOf('epf')) },
        { label: 'NPS', value: M(valueOf('nps')) },
        ...(otherVal > 0 ? [{ label: 'Other', value: M(otherVal) }] : []),
        { label: 'Accounts', value: `${pfCount} PF · ${npsCount} NPS${otherCount ? ` · ${otherCount} other` : ''}` },
        { label: 'Share of assets', value: pct(c.share) },
      ];
      const last = latest(t.ppfAccounts.map((p) => p.lastUpdated || p.extractedAt));
      note = last ? `Passbook uploaded ${fmtDate(last)}` : 'Upload an EPFO passbook to update';
      break;
    }
    case 'property': {
      const buy = t.properties.reduce((s, p) => s + (p.purchasePrice || 0), 0);
      metas = [
        { label: 'Properties', value: t.properties.length },
        { label: 'Purchase cost', value: M(buy) },
        { label: 'Appreciation', value: `${S(c.value - buy)}${buy ? ` (${(((c.value - buy) / buy) * 100).toFixed(1)}%)` : ''}`, tone: c.value - buy >= 0 ? 'gain' : 'loss' },
        { label: 'Share of assets', value: pct(c.share) },
      ];
      note = 'Owner estimates';
      break;
    }
    case 'recv': {
      const overdue = t.receivables.filter((r) => !r.paidDate && (daysUntil(r.dueDate) ?? 1) < 0);
      const principal = t.receivables.reduce((s, r) => s + (r.balance || 0), 0);
      metas = [
        { label: 'People', value: t.receivables.length },
        { label: 'Principal', value: M(principal) },
        { label: 'Agreed interest', value: M(c.value - principal) },
        { label: 'Overdue', value: overdue.length, tone: overdue.length ? 'loss' : 'neutral' },
      ];
      break;
    }
    case 'stocks': {
      const invested = [...t.stocks, ...t.funds].reduce((s, h: any) => s + (h.average_price || 0) * (h.quantity || 0), 0);
      metas = [
        { label: 'Holdings', value: `${t.stocks.length} stocks · ${t.funds.length} funds` },
        { label: 'Invested', value: M(invested) },
        { label: 'Unrealised', value: `${t.unrealised >= 0 ? '▲' : '▼'} ${S(t.unrealised)}`, tone: t.unrealised >= 0 ? 'gain' : 'loss' },
        { label: 'Share of assets', value: pct(c.share) },
      ];
      note = 'Prices from Zerodha · cached between syncs';
      break;
    }
  }

  return (
    <PageHeader
      crumbs={crumbs ?? [{ label: 'Portfolio', href: '/portfolio' }, { label: c.label }]}
      title={c.label}
      actions={actions}
      meta={note ?? false}
      hero={{ value: M(c.value), metas }}
    />
  );
}

type MarketView = 'All' | 'Stocks' | 'Funds';

/** Stocks & funds merged view; /portfolio/mutual-funds preselects Funds. */
export function StocksFundsView({ initial }: { initial: MarketView }) {
  const [view, setView] = useState<MarketView>(initial);
  return (
    <>
      <ClassHeader classKey="stocks" />
      <div className="mb-5">
        <Segmented<MarketView>
          value={view}
          onChange={setView}
          options={['All', 'Stocks', 'Funds']}
          ariaLabel="Holdings type"
        />
      </div>
      <StocksFundsCharts view={view} />
      <div className="space-y-4">
        {view !== 'Funds' && <StocksDashboard />}
        {view !== 'Stocks' && <MutualFundsDashboard />}
      </div>
    </>
  );
}

/** Largest holdings by current value, and invested vs current value for each — follows the All / Stocks / Funds toggle. */
function StocksFundsCharts({ view }: { view: MarketView }) {
  const t = usePortfolioTotals();
  const holdings = [
    ...(view !== 'Funds' ? t.stocks.map((h) => ({ name: h.tradingsymbol, qty: h.quantity, avg: h.average_price, ltp: h.last_price })) : []),
    ...(view !== 'Stocks' ? t.funds.map((h) => ({ name: (h.fund_name || h.tradingsymbol).split(' - ')[0], qty: h.quantity, avg: h.average_price, ltp: h.last_price })) : []),
  ]
    .map((h) => ({ name: h.name, invested: (h.avg || 0) * (h.qty || 0), current: (h.ltp || 0) * (h.qty || 0) }))
    .filter((h) => h.current > 0 || h.invested > 0)
    .sort((a, b) => b.current - a.current);
  if (holdings.length === 0) return null;
  const top = holdings.slice(0, 8);
  return (
    <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <DonutPanel title="Top holdings" subtitle="Share of current value" slices={toSlices(holdings.map((h) => ({ name: h.name, value: h.current })))} centreLabel="Value" />
      <BarsPanel
        title="Invested vs current value"
        subtitle={holdings.length > top.length ? `Largest ${top.length} of ${holdings.length} holdings` : 'Cost of each holding and what it is worth today'}
        rows={top}
        series={[
          { key: 'invested', label: 'Invested', color: 'var(--c-ret)' },
          { key: 'current', label: 'Current value', color: 'var(--color-accent)' },
        ]}
      />
    </div>
  );
}
