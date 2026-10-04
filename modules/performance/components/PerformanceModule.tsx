'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { Dot, EmptyState, LinkButton, PageHeader, Panel, PanelHeader, Segmented, Skeleton } from '@/shared/components/ui';
import { useMoney, fmtDate, monthShort } from '@/shared/hooks/useMoney';
import { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';
import { useSnapshots, snapshotClasses } from '@/shared/hooks/useSnapshots';

/** Classes as stored in month-end snapshots (PPF records sit with deposits; EPF separate). */
const SERIES = [
  { key: 'property', label: 'Properties', color: 'var(--c-prop)', href: '/portfolio/properties' },
  { key: 'deposits', label: 'Deposits, bonds & PPF', color: 'var(--c-dep)', href: '/portfolio/investments' },
  { key: 'market', label: 'Stocks & funds', color: 'var(--c-stock)', href: '/portfolio/stocks' },
  { key: 'epf', label: 'EPF', color: 'var(--c-ret)', href: '/portfolio/provident-fund' },
  { key: 'receivables', label: 'Receivables', color: 'var(--c-recv)', href: '/portfolio/receivables' },
  { key: 'cash', label: 'Cash & bank', color: 'var(--c-cash)', href: '/portfolio/bank-balances' },
] as const;
type SeriesKey = (typeof SERIES)[number]['key'] | 'loans';

interface Row {
  id: string;
  label: string;
  sub: string;
  short: string;
  live?: boolean;
  v: Record<SeriesKey | 'netWorth', number>;
}

const assetsOf = (r: Row) => SERIES.reduce((s, x) => s + r.v[x.key], 0);

export function PerformanceModule() {
  const { M, C, S } = useMoney();
  const t = usePortfolioTotals();
  const { monthly, yearly, isLoading } = useSnapshots();
  const [mode, setMode] = useState<'Monthly' | 'Yearly'>('Monthly');
  const [exact, setExact] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const now = new Date();

  const today: Row = useMemo(
    () => ({
      id: 'today',
      label: 'Today',
      sub: 'Live',
      short: 'Today',
      live: true,
      v: {
        property: t.totalProperties,
        deposits: t.totalInvestments,
        market: t.totalStocks + t.totalMutualFunds,
        epf: t.totalPPF,
        receivables: t.totalReceivables,
        cash: t.totalBankBalances,
        loans: t.totalLoans,
        netWorth: t.netWorth,
      },
    }),
    [t.totalProperties, t.totalInvestments, t.totalStocks, t.totalMutualFunds, t.totalPPF, t.totalReceivables, t.totalBankBalances, t.totalLoans, t.netWorth],
  );

  // Oldest → newest, ending with today's live values
  const rows: Row[] = useMemo(() => {
    const thisMonth = now.getFullYear() * 100 + now.getMonth() + 1;
    if (mode === 'Monthly') {
      const past = monthly.filter((s) => s.year === now.getFullYear() && s.year * 100 + (s.month ?? 12) < thisMonth);
      return [
        ...past.map((s) => {
          const d = new Date(s.year, (s.month ?? 12) - 1, 1);
          return {
            id: `${s.year}-${s.month}`,
            label: d.toLocaleDateString('en-GB', { month: 'long' }),
            sub: `${monthShort(s.month ?? 12)} ${s.year}`,
            short: monthShort(s.month ?? 12),
            v: snapshotClasses(s),
          };
        }),
        today,
      ];
    }
    const byYear = new Map<number, (typeof monthly)[number]>();
    for (const s of [...yearly, ...monthly]) if (s.year < now.getFullYear()) byYear.set(s.year, s); // later (month 12) wins
    return [
      ...[...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([y, s]) => ({ id: String(y), label: String(y), sub: 'Year end', short: String(y), v: snapshotClasses(s) })),
      today,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly, yearly, mode, today]);

  const selIdx = Math.max(1, sel ? rows.findIndex((r) => r.id === sel) : rows.length - 1);
  const cur = rows[selIdx] ?? today;
  const prev = rows[selIdx - 1];

  const changes = useMemo(() => {
    if (!prev) return [];
    const list: { label: string; color: string; delta: number; from: number; to: number }[] = SERIES.map((s) => ({
      label: s.label,
      color: s.color,
      delta: cur.v[s.key] - prev.v[s.key],
      from: prev.v[s.key],
      to: cur.v[s.key],
    }));
    // A smaller loan balance counts as a lift
    list.push({ label: 'Loans', color: 'var(--c-loan)', delta: prev.v.loans - cur.v.loans, from: prev.v.loans, to: cur.v.loans });
    return list;
  }, [cur, prev]);
  const lifts = changes.filter((c) => c.delta > 0.5).sort((a, b) => b.delta - a.delta);
  const drags = changes.filter((c) => c.delta < -0.5).sort((a, b) => a.delta - b.delta);
  const flat = changes.filter((c) => Math.abs(c.delta) <= 0.5);
  const maxAbs = Math.max(1, ...changes.map((c) => Math.abs(c.delta)));
  const nwDelta = prev ? cur.v.netWorth - prev.v.netWorth : 0;
  const nwPct = prev && prev.v.netWorth ? (nwDelta / Math.abs(prev.v.netWorth)) * 100 : 0;
  const maxAssets = Math.max(1, ...rows.map(assetsOf));
  const F = exact ? (v: number) => M(v) : C;

  const kpi = (label: string, value: React.ReactNode, sub: React.ReactNode, valueTone = 'text-ink', subTone = 'text-muted') => (
    <Panel>
      <div className="eyebrow">{label}</div>
      <div className={cn('mt-2.5 truncate text-[24px] font-bold tracking-[-0.02em]', valueTone)}>{value}</div>
      <div className={cn('mt-2.5 text-[13px]', subTone)}>{sub}</div>
    </Panel>
  );

  const changeRow = (c: (typeof changes)[number], tone: 'gain' | 'loss') => (
    <li key={c.label} className="border-b border-divider py-3.5">
      <div className="flex items-center gap-2.5">
        <Dot color={c.color} size={9} />
        <span className="flex-1 text-[15px]">{c.label}</span>
        <span className={cn('text-[15px] font-semibold tabular-nums', tone === 'gain' ? 'text-gain' : 'text-loss')}>{S(c.delta, { compact: true })}</span>
      </div>
      <div className="mt-2 flex items-center gap-3 pl-5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
          <div className={cn('h-full rounded-full', tone === 'gain' ? 'bg-gain' : 'bg-loss')} style={{ width: `${(Math.abs(c.delta) / maxAbs) * 100}%` }} />
        </div>
        <span className="text-[12.5px] tabular-nums text-muted">
          {C(c.from)} → {C(c.to)}
        </span>
      </div>
    </li>
  );

  const prevName = prev ? (prev.live ? 'today' : prev.short) : '';
  const curName = cur.live ? 'today' : cur.label;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Performance', href: '/performance' }, { label: mode }]}
        title="Performance"
        actions={<LinkButton href="/performance/snapshots" variant="secondary">Monthly snapshots</LinkButton>}
        meta={false}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={mode} onChange={(m) => { setMode(m); setSel(null); }} options={['Monthly', 'Yearly']} ariaLabel="Period" />
        <p className="text-[13px] text-muted">{mode === 'Monthly' ? `Month-end snapshots for ${now.getFullYear()}, plus today's live values` : 'Year-end snapshots, plus today\'s live values'}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpi(cur.live ? 'Net worth · today' : `Net worth · ${cur.short}`, C(cur.v.netWorth), cur.live ? `Live values · ${fmtDate(now)}` : cur.sub)}
        {kpi(`Change vs ${prevName || '—'}`, prev ? S(nwDelta, { compact: true }) : '—', prev ? `${nwPct >= 0 ? '+' : '−'}${Math.abs(nwPct).toFixed(2)}%` : 'No earlier snapshot', Math.abs(nwDelta) < 0.5 ? 'text-ink' : nwDelta > 0 ? 'text-gain' : 'text-loss', Math.abs(nwDelta) < 0.5 ? 'text-muted' : nwDelta > 0 ? 'text-gain' : 'text-loss')}
        {kpi('Biggest lift', lifts[0]?.label ?? '—', lifts[0] ? S(lifts[0].delta, { compact: true }) : 'Nothing rose', 'text-ink', 'text-gain')}
        {kpi('Biggest drag', drags[0]?.label ?? '—', drags[0] ? S(drags[0].delta, { compact: true }) : 'Nothing fell', 'text-ink', 'text-loss')}
      </div>

      {/* Assets by month — stacked bars */}
      <Panel className="mt-4">
        <PanelHeader title={mode === 'Monthly' ? 'Assets by month' : 'Assets by year'} action={<span className="text-[13px] text-muted">Tap a bar to compare that {mode === 'Monthly' ? 'month' : 'year'}</span>} />
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : rows.length < 2 ? (
          <EmptyState title="No snapshots yet">Month-end snapshots are saved from Performance → Monthly snapshots. Once one exists, monthly change shows here.</EmptyState>
        ) : (
          <div className="flex h-[260px] items-end gap-[clamp(6px,2vw,28px)] overflow-x-auto px-1 pb-1">
            {rows.map((r, i) => {
              const total = assetsOf(r);
              const on = i === selIdx;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSel(r.id)}
                  aria-pressed={on}
                  aria-label={`${r.label}: ${C(total)}`}
                  className="group flex h-full min-w-[40px] flex-1 flex-col items-center justify-end gap-2">
                  <span className={cn('text-[11.5px] font-semibold tabular-nums', on ? 'text-ink' : 'text-muted')}>{C(total)}</span>
                  <span
                    className={cn('flex w-full max-w-[46px] flex-col-reverse overflow-hidden rounded-[6px] transition-opacity', !on && 'opacity-55 group-hover:opacity-80')}
                    style={{ height: `${(total / maxAssets) * 190}px` }}>
                    {SERIES.map((s) => (
                      <span key={s.key} style={{ height: `${total ? (r.v[s.key] / total) * 100 : 0}%`, background: s.color }} />
                    ))}
                  </span>
                  <span className={cn('text-[12.5px]', on ? 'font-semibold text-accent-700' : 'text-muted')}>{r.short}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <Dot color={s.color} size={9} /> {s.label}
            </span>
          ))}
        </div>
      </Panel>

      {/* What changed */}
      {prev && (
        <Panel className="mt-4">
          <h2 className="text-[19px]">
            What changed · {curName} vs {prevName}
          </h2>
          <p className="mt-1.5 text-[15px]">
            Net worth {nwDelta >= 0 ? 'rose' : 'fell'} {C(Math.abs(nwDelta))} ({Math.abs(nwPct).toFixed(2)}%) from {prev.live ? 'today' : prev.sub} to {cur.live ? 'today' : cur.sub}.
            {nwDelta < 0 && drags[0] ? ` ${drags[0].label} pulled it down most.` : nwDelta >= 0 && lifts[0] ? ` ${lifts[0].label} lifted it most.` : ''}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-x-10 md:grid-cols-2">
            <div>
              <h3 className="px-2 pb-2 text-[14.5px] font-semibold text-gain">Lifted net worth</h3>
              {lifts.length ? <ul>{lifts.map((c) => changeRow(c, 'gain'))}</ul> : <p className="py-3 text-[14px] text-muted">Nothing rose this {mode === 'Monthly' ? 'month' : 'year'}.</p>}
            </div>
            <div>
              <h3 className="px-2 pb-2 text-[14.5px] font-semibold text-loss">Pulled it down</h3>
              {drags.length ? <ul>{drags.map((c) => changeRow(c, 'loss'))}</ul> : <p className="py-3 text-[14px] text-muted">Nothing fell.</p>}
            </div>
          </div>
          {flat.length > 0 && <p className="mt-4 text-[13px] text-muted">No change: {flat.map((c) => c.label).join(', ')}</p>}
          <p className="mt-2 text-[12.5px] text-muted">A smaller loan balance counts as a lift. Tap a row in the table to compare another {mode === 'Monthly' ? 'month' : 'year'}.</p>
        </Panel>
      )}

      {/* Month by month */}
      <Panel flush className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-[22px]">
          <div>
            <h2 className="text-[19px]">{mode === 'Monthly' ? 'Month by month' : 'Year by year'}</h2>
            <p className="mt-1 text-[13px] text-muted">Newest first · change vs the period before · tap a row to analyse it above</p>
          </div>
          <Segmented value={exact ? 'Exact' : 'Short'} onChange={(v) => setExact(v === 'Exact')} options={['Short', 'Exact']} />
        </div>
        <div className="overflow-x-auto">
          <table className="ledger-table min-w-[980px]">
            <thead>
              <tr>
                <th className="!pl-6">{mode === 'Monthly' ? 'Month' : 'Year'}</th>
                <th className="num bg-accent-100">
                  <span className="inline-flex items-center gap-1.5"><Dot color="var(--color-text)" size={8} /> Net worth</span>
                </th>
                {SERIES.map((s) => (
                  <th key={s.key} className="num">
                    <span className="inline-flex items-center gap-1.5"><Dot color={s.color} size={8} /> {s.label}</span>
                  </th>
                ))}
                <th className="num !pr-6">
                  <span className="inline-flex items-center gap-1.5"><Dot color="var(--c-loan)" size={8} /> Loans</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => {
                const idx = rows.indexOf(r);
                const p = rows[idx - 1];
                const cell = (k: SeriesKey | 'netWorth', invert = false) => {
                  const d = p ? r.v[k] - p.v[k] : null;
                  const good = d == null ? null : invert ? d < 0 : d > 0;
                  return (
                    <>
                      <div className="text-[14.5px] tabular-nums">{F(r.v[k])}</div>
                      <div className={cn('mt-0.5 text-[12px] tabular-nums', d == null || Math.abs(d) < 0.5 ? 'text-muted' : good ? 'text-gain' : 'text-loss')}>
                        {d == null ? '—' : Math.abs(d) < 0.5 ? '0' : S(d, { compact: !exact })}
                      </div>
                    </>
                  );
                };
                const on = idx === selIdx;
                return (
                  <tr key={r.id} onClick={() => setSel(r.id)} className={cn('cursor-pointer', on && '[&>td]:!bg-tile')}>
                    <td className="!pl-6">
                      <div className="text-[15px] font-semibold">{r.label}</div>
                      <div className="text-[12.5px] text-muted">{r.sub}</div>
                    </td>
                    <td className="num bg-accent-100 font-semibold">{cell('netWorth')}</td>
                    {SERIES.map((s) => (
                      <td key={s.key} className="num">
                        {cell(s.key)}
                      </td>
                    ))}
                    <td className="num !pr-6">{cell('loans', true)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
