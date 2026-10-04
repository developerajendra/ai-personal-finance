'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/shared/utils/cn';
import { Dot, LinkButton, PageHeader, Panel, PanelHeader, Segmented, Skeleton } from '@/shared/components/ui';
import { NetWorthTrendChart } from '@/shared/components/NetWorthTrendChart';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';
import { useSnapshots } from '@/shared/hooks/useSnapshots';
import { useNetWorthPeriod } from '@/shared/hooks/useNetWorthPeriod';
import { useFinancialData } from '@/shared/hooks/useFinancialData';
import { ASSET_CLASSES, CLASS_LABELS, DEFAULT_RANGE, RANGES, chartPoints, contributions, rangeLabel, tableRows, type RangeKey } from '@/shared/utils/netWorthHistory';
import { CLASS_COLORS, ContributionBridge, Reconciliation, WealthSummary } from './PeriodReconciliation';
import { SnapshotTable, rowLabel } from './SnapshotTable';
import { SupportingAnalysis } from './SupportingAnalysis';

/**
 * Trends & analysis: how the financial position changed over a selected period and why, with
 * investment returns, cash flow and debt history where records support them. Current position
 * lives on the Dashboard. History rules are in shared/utils/netWorthHistory.
 */
export function PerformanceModule({ range: initialRange }: { range?: RangeKey } = {}) {
  const { C } = useMoney();
  const router = useRouter();
  const t = usePortfolioTotals();
  const snapshots = useSnapshots();
  const { transactions } = useFinancialData();
  const [range, setRange] = useState<RangeKey>(initialRange ?? DEFAULT_RANGE);
  const [mode, setMode] = useState<'Monthly' | 'Yearly'>('Monthly');
  const [view, setView] = useState<'Net worth' | 'Asset composition'>('Net worth');
  const [sel, setSel] = useState<string>('today');

  const changeRange = (r: RangeKey) => {
    setRange(r);
    router.replace(`/performance?range=${r}`, { scroll: false });
  };

  // Same query as the dashboard: broker connection status (live vs last synced prices)
  const { data: stocksMeta } = useQuery<{ isAuthenticated?: boolean }>({
    queryKey: ['stocks'],
    queryFn: async () => {
      const response = await fetch('/api/zerodha/stocks');
      if (!response.ok) return { stocks: [] };
      return response.json();
    },
  });
  const marketLive = stocksMeta ? !!stocksMeta.isAuthenticated : undefined;

  const period = useNetWorthPeriod(t, snapshots, range);
  const { now, live, history, cmp, opening, isLoading } = period;
  const points = useMemo(() => chartPoints(history.observations, live, range, now, opening), [history, live, range, now, opening]);
  const periodFrom = cmp.status === 'ok' ? cmp.opening.date : cmp.requestedStart;
  const periodFromKey = periodFrom ? points.find((p) => p.date.getTime() >= periodFrom.getTime() - 864e5)?.key : undefined;

  const rows = useMemo(() => tableRows(history.observations, live, mode === 'Monthly' ? 'monthly' : 'yearly', now), [history, live, mode, now]);
  const selRow = rows.find((r) => r.key === sel && r.obs && r.obs.reason !== 'empty') ?? rows[0];
  const selContrib = selRow?.obs && selRow.prev ? contributions(selRow.prev, selRow.obs) : null;

  // Secondary view: assets-only composition, oldest → newest, rows with data only
  const bars = useMemo(() => [...rows].reverse().filter((r) => r.obs && r.obs.reason !== 'empty'), [rows]);
  const maxAssets = Math.max(1, ...bars.map((r) => r.obs!.assets));

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Trends & analysis', href: '/performance' }, { label: rangeLabel(range) }]}
        title="Trends & analysis"
        actions={
          <LinkButton href="/performance/snapshots" variant="secondary">
            Monthly snapshots
          </LinkButton>
        }
        meta={false}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented<RangeKey> options={RANGES} value={range} onChange={changeRange} ariaLabel="Period" />
        <p className="text-[13px] text-muted">
          {cmp.status === 'ok' ? `Comparing ${fmtDate(cmp.opening.date)} (recorded month-end) with today (partial month)` : 'No recorded comparison point for this period'}
          {history.duplicates > 0 && ` · ${history.duplicates} extra save${history.duplicates === 1 ? '' : 's'} kept in drill-down`}
        </p>
      </div>

      {/* 1. Selected-period wealth summary */}
      {isLoading ? <Skeleton className="h-[120px] w-full" /> : <WealthSummary period={period} range={range} />}

      {/* 2. Net-worth history (primary), assets-only composition as a secondary view */}
      <Panel className="mt-4">
        <PanelHeader
          title={view === 'Net worth' ? 'Net-worth history' : 'Asset composition'}
          subtitle={view === 'Net worth' ? `${rangeLabel(range)} · month-end values, then today` : 'Assets only, before liabilities · rows with data'}
          action={<Segmented value={view} onChange={setView} options={['Net worth', 'Asset composition']} ariaLabel="Chart" />}
        />
        {view === 'Net worth' ? (
          <NetWorthTrendChart points={points} loading={snapshots.isLoading} height="h-[260px]" periodFromKey={periodFromKey} selectedKey={selRow?.live ? undefined : selRow?.key} />
        ) : bars.length < 2 ? (
          <p className="py-6 text-[13.5px] text-muted">Needs at least one month-end snapshot with data.</p>
        ) : (
          <>
            <div className="flex h-[240px] items-end gap-[clamp(6px,2vw,24px)] overflow-x-auto px-1 pb-1">
              {bars.map((r) => {
                const o = r.obs!;
                const on = r.key === selRow?.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSel(r.key)}
                    aria-pressed={on}
                    aria-label={`${rowLabel(r, mode)}: assets ${C(o.assets)}`}
                    className="group flex h-full min-w-[40px] flex-1 flex-col items-center justify-end gap-2">
                    <span className={cn('text-[11.5px] font-semibold tabular-nums', on ? 'text-ink' : 'text-muted')}>{C(o.assets)}</span>
                    <span
                      className={cn('flex w-full max-w-[46px] flex-col-reverse overflow-hidden rounded-[6px]', !on && 'opacity-55 group-hover:opacity-80')}
                      style={{ height: `${(o.assets / maxAssets) * 170}px` }}>
                      {ASSET_CLASSES.map((k) => (
                        <span key={k} style={{ height: `${o.assets ? (o.classes[k] / o.assets) * 100 : 0}%`, background: CLASS_COLORS[k] }} />
                      ))}
                    </span>
                    <span className={cn('text-[12px]', on ? 'font-semibold text-accent-700' : 'text-muted')}>
                      {r.live ? 'Today' : mode === 'Yearly' ? r.date.getFullYear() : r.date.toLocaleDateString('en-GB', { month: 'short' })}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
              {ASSET_CLASSES.map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <Dot color={CLASS_COLORS[k]} size={8} /> {CLASS_LABELS[k]}
                </span>
              ))}
            </div>
          </>
        )}
      </Panel>

      {/* 3. Reconciliation of opening to closing net worth */}
      <Reconciliation period={period} range={range} />

      {/* 4. Analysis of the selected row, then the detailed table */}
      {selRow && (
        <Panel className="mt-4">
          <PanelHeader
            title={`Contribution to net-worth change · ${rowLabel(selRow, mode)}`}
            subtitle={
              selRow.prev
                ? `vs ${fmtDate(selRow.prev.date)}${selRow.prevSkipped ? ' — the latest earlier value with data (months in between are missing or empty)' : ''}${selRow.live ? ' · partial month' : ''}`
                : 'No earlier value to compare with'
            }
          />
          {selContrib && selRow.prev && selRow.obs ? (
            <ContributionBridge
              rows={selContrib.rows}
              opening={selRow.prev.netWorth}
              closing={selRow.obs.netWorth}
              openingLabel={fmtDate(selRow.prev.date)}
              closingLabel={selRow.live ? 'today' : fmtDate(selRow.obs.date)}
              residual={selContrib.residual}
            />
          ) : (
            <p className="text-[13.5px] text-muted">Select a row that has an earlier value with data.</p>
          )}
          {(selRow.obs?.quality === 'estimated' || selRow.prev?.quality === 'estimated') && (
            <p className="mt-2 text-[12.5px] text-warn">One side of this comparison is an estimate (rebuilt or saved early), so this change is not verified.</p>
          )}
        </Panel>
      )}
      <SnapshotTable
        rows={rows}
        mode={mode}
        onMode={(m) => {
          setMode(m);
          setSel('today');
        }}
        selected={selRow?.key ?? 'today'}
        onSelect={setSel}
        periodFrom={periodFrom}
      />

      {/* 5. Investment returns, cash flow and debt history where records support them */}
      <SupportingAnalysis t={t} transactions={transactions} marketLive={marketLive} now={now} />
    </div>
  );
}
