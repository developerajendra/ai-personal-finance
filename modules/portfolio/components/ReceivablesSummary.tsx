'use client';

import { Dot, Panel, PanelHeader, StackBar } from '@/shared/components/ui';
import { useMoney, pct } from '@/shared/hooks/useMoney';
import { usePortfolioTotals, receivableExpected, daysUntil } from '@/shared/hooks/usePortfolioTotals';
import { BarsPanel, DonutPanel, toSlices } from './ClassCharts';

/** KPI row, per-person charts and ageing buckets (overdue / ≤90 days / later / no due date) for published receivables. */
export function ReceivablesSummary() {
  const { M } = useMoney();
  const t = usePortfolioTotals();
  const open = t.receivables.filter((r) => !r.paidDate);
  const rows = open.map((r) => ({ r, ...receivableExpected(r), d: daysUntil(r.dueDate) }));

  const buckets = [
    { key: 'overdue', label: 'Overdue', color: 'var(--fin-loss)', items: rows.filter((x) => x.d != null && x.d < 0) },
    { key: '90', label: 'Due within 90 days', color: 'var(--fin-warn)', items: rows.filter((x) => x.d != null && x.d >= 0 && x.d <= 90) },
    { key: 'later', label: 'Due later', color: 'var(--color-accent)', items: rows.filter((x) => x.d != null && x.d > 90) },
    { key: 'none', label: 'No due date', color: 'var(--color-neutral-400)', items: rows.filter((x) => x.d == null) },
  ].map((b) => ({ ...b, value: b.items.reduce((s, x) => s + x.total, 0) }));

  const expected = rows.reduce((s, x) => s + x.total, 0);
  const principal = rows.reduce((s, x) => s + x.principal, 0);
  const byPerson = toSlices(rows.map((x) => ({ name: x.r.bankName, value: x.total })));
  const perPerson = Object.values(
    rows.reduce((acc, x) => {
      const p = (acc[x.r.bankName] ??= { name: x.r.bankName, principal: 0, interest: 0 });
      p.principal += x.principal;
      p.interest += x.interest;
      return acc;
    }, {} as Record<string, { name: string; principal: number; interest: number }>),
  ).sort((a, b) => b.principal + b.interest - (a.principal + a.interest));
  const overdue = buckets[0]!;
  const soon = buckets[1]!;

  const kpi = (label: string, value: string, note: string, tone = 'text-ink') => (
    <Panel>
      <div className="eyebrow">{label}</div>
      <div className={`mt-2.5 text-[24px] font-bold tracking-[-0.02em] ${tone}`}>{value}</div>
      <div className="mt-2.5 text-[13px] text-muted">{note}</div>
    </Panel>
  );

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpi('Owed to you', M(expected), `${open.length} open · incl. agreed interest`)}
        {kpi('Principal', M(principal), `Interest ${M(expected - principal)}`)}
        {kpi('Overdue', M(overdue.value), `${overdue.items.length} ${overdue.items.length === 1 ? 'person' : 'people'}`, overdue.value > 0 ? 'text-loss' : 'text-ink')}
        {kpi('Due in 90 days', M(soon.value), `${soon.items.length} expected`)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <DonutPanel title="By person" subtitle="Share of what you are owed, incl. agreed interest" slices={byPerson} centreLabel="Owed" />
        <BarsPanel
          title="Principal vs interest"
          subtitle="Amount lent and the interest agreed on it, per person"
          rows={perPerson}
          series={[
            { key: 'principal', label: 'Principal', color: 'var(--c-ret)' },
            { key: 'interest', label: 'Interest', color: 'var(--color-accent)' },
          ]}
          stacked
        />
      </div>
      <Panel>
        <PanelHeader title="Ageing" action={<span className="text-[13px] text-muted">Expected totals including agreed interest</span>} />
        <StackBar segments={buckets.map((b) => ({ value: b.value, color: b.color, label: b.label }))} height={12} />
        <ul className="mt-3">
          {buckets.map((b) => (
            <li key={b.key} className="grid grid-cols-[16px_1fr_auto_64px_56px] items-center gap-2 border-b border-divider py-2.5 text-[14px] last:border-0">
              <Dot color={b.color} size={9} />
              <span>{b.label}</span>
              <span className="tabular-nums">{M(b.value)}</span>
              <span className="text-right text-[13px] text-muted">{b.items.length} {b.items.length === 1 ? 'person' : 'people'}</span>
              <span className="text-right text-[13px] tabular-nums text-muted">{pct(expected ? (b.value / expected) * 100 : 0)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
