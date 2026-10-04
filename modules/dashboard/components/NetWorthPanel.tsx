'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Droplets, Layers, Lock } from 'lucide-react';
import type { FinancialSnapshot } from '@/shared/types';
import { Panel, Segmented, Tag, Skeleton } from '@/shared/components/ui';
import { useMoney, monthShort } from '@/shared/hooks/useMoney';
import { useSnapshots } from '@/shared/hooks/useSnapshots';

type Range = '3M' | '6M' | 'YTD';
type View = 'all' | 'liquid' | 'locked';

/**
 * Liquid = cash you could raise within days (bank balances, market holdings, deposits marked liquid,
 * receivables). Locked = property, fixed-marked assets and provident fund — EPF is counted here even
 * though the shared liquid total includes it, because it cannot be withdrawn at will.
 */
const VIEWS: Record<View, { eyebrow: string; series: string; note: string; of: (s: Pick<FinancialSnapshot, 'netWorth' | 'totalLiquidAssets' | 'totalFixedAssets' | 'totalPPF'>) => number }> = {
  all: { eyebrow: 'Net worth', series: 'Net worth', note: 'Everything you own minus loans', of: (s) => s.netWorth },
  liquid: {
    eyebrow: 'Liquid assets',
    series: 'Liquid',
    note: 'Cash and holdings you could sell within days',
    of: (s) => (s.totalLiquidAssets || 0) - (s.totalPPF || 0),
  },
  locked: {
    eyebrow: 'Locked-in assets',
    series: 'Locked in',
    note: 'Property, fixed assets and provident fund',
    of: (s) => (s.totalFixedAssets || 0) + (s.totalPPF || 0),
  },
};

/** Net worth hero with change pills and a trend chart fed by month-end snapshots + today's live value. */
export function NetWorthPanel({
  netWorth,
  liquidAssets,
  fixedAssets,
  ppf,
  isLoading,
}: {
  netWorth: number;
  /** shared liquid total (includes EPF) */
  liquidAssets: number;
  fixedAssets: number;
  /** EPF passbook total — moved from liquid to locked for this view */
  ppf: number;
  isLoading?: boolean;
}) {
  const { M, S } = useMoney();
  const { monthly, isLoading: snapsLoading } = useSnapshots();
  const [range, setRange] = useState<Range>('YTD');
  const [view, setView] = useState<View>('all');
  const v = VIEWS[view];
  const current = v.of({ netWorth, totalLiquidAssets: liquidAssets, totalFixedAssets: fixedAssets, totalPPF: ppf });

  const now = new Date();
  const year = now.getFullYear();

  const { points, monthChange, ytdChange } = useMemo(() => {
    const past = monthly.filter((s) => s.year < year || (s.year === year && (s.month ?? 0) < now.getMonth() + 1));
    let series = past;
    if (range === 'YTD') series = past.filter((s) => s.year === year);
    if (range === '3M') series = past.slice(-3);
    if (range === '6M') series = past.slice(-6);
    const pts = [
      ...series.map((s) => ({ label: monthShort(s.month ?? 12), value: v.of(s) })),
      { label: 'Today', value: current },
    ];
    const last = past[past.length - 1];
    const yearStart = [...past].reverse().find((s) => s.year === year - 1) ?? past.find((s) => s.year === year);
    return {
      points: pts,
      monthChange: last ? current - v.of(last) : null,
      ytdChange: yearStart ? current - v.of(yearStart) : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly, range, current, view, year]);

  const pill = (v: number | null, label: string) =>
    v == null ? null : (
      <Tag tone={v > 0 ? 'gain' : v < 0 ? 'loss' : 'neutral'}>
        <span className="font-semibold">
          {v > 0 ? '▲ ' : v < 0 ? '▼ ' : ''}
          {S(v)}
        </span>
        <span className="opacity-80">{label}</span>
      </Tag>
    );

  return (
    <Panel className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="eyebrow">{v.eyebrow}</div>
        <Segmented<View>
          className="seg-sm"
          ariaLabel="Show net worth, liquid or locked-in assets"
          value={view}
          onChange={setView}
          options={[
            { value: 'all', label: <span className="inline-flex items-center gap-1" title="Net worth: everything minus loans"><Layers className="h-3.5 w-3.5" />All</span> },
            { value: 'liquid', label: <span className="inline-flex items-center gap-1" title={VIEWS.liquid.note}><Droplets className="h-3.5 w-3.5" />Liquid</span> },
            { value: 'locked', label: <span className="inline-flex items-center gap-1" title={VIEWS.locked.note}><Lock className="h-3.5 w-3.5" />Locked</span> },
          ]}
        />
      </div>
      {isLoading ? (
        <Skeleton className="mt-3 h-12 w-72" />
      ) : (
        <div className="mt-2 text-[clamp(36px,4.2vw,48px)] font-bold leading-none tracking-[-0.035em] text-ink">{M(current)}</div>
      )}
      <p className="mt-1.5 text-[13px] text-muted">
        {v.note}
        {view !== 'all' && !isLoading && liquidAssets + fixedAssets > 0 && ` · ${Math.round((current / (liquidAssets + fixedAssets)) * 100)}% of assets`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {pill(monthChange, 'this month')}
        {pill(ytdChange, 'year to date')}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href="/performance" className="tag tag-accent !px-3.5 !py-1.5 !text-[13px] !font-semibold">
          Month &amp; year breakdown
        </Link>
        <Segmented<Range> options={['3M', '6M', 'YTD']} value={range} onChange={setRange} ariaLabel="Chart range" />
      </div>
      <div className="mt-4 h-[170px] min-h-[150px] flex-1">
        {snapsLoading ? (
          <Skeleton className="h-full w-full" />
        ) : points.length < 2 ? (
          <p className="pt-10 text-[13.5px] text-muted">The trend appears once the first month-end snapshot is saved (Performance → Monthly snapshots).</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" padding={{ left: 14, right: 18 }} axisLine={false} tickLine={false} tick={{ fill: 'var(--color-neutral-600)', fontSize: 12 }} interval={0} />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip
                cursor={{ stroke: 'var(--color-divider)' }}
                contentStyle={{ background: 'var(--dialog-bg)', border: 0, borderRadius: 12, boxShadow: 'var(--shadow-md)', color: 'var(--color-text)' }}
                formatter={(val: number) => [M(val), v.series]}
              />
              <Area
                type="linear"
                dataKey="value"
                stroke="var(--color-accent)"
                strokeWidth={2}
                fill="url(#nwFill)"
                dot={{ r: 3.5, fill: 'var(--panel-bg)', stroke: 'var(--color-accent)', strokeWidth: 1.6 }}
                activeDot={{ r: 5, fill: 'var(--color-accent)' }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
