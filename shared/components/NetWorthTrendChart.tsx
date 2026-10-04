'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/shared/components/ui';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { cn } from '@/shared/utils/cn';
import type { ChartPoint, EstimateReason } from '@/shared/utils/netWorthHistory';

const ESTIMATE_TEXT: Record<EstimateReason, string> = {
  rebuilt: 'Estimated — rebuilt later from the balances held on the save date',
  early: 'Estimated — saved before the month ended',
  'unknown-date': 'Estimated — save date unknown',
  inconsistent: 'Estimated — stored totals do not add up',
  empty: 'Empty save — nothing was tracked yet; not a zero balance',
};

/**
 * Net worth over time from chartPoints(): solid between recorded points, dashed where an estimate is
 * involved, gaps for missing months, a break where an asset or loan type first appears. Shared by the
 * dashboard Net worth card and Trends & analysis so both draw history the same way.
 */
export function NetWorthTrendChart({
  points,
  loading,
  className,
  height = 'h-[200px] min-h-[170px]',
  periodFromKey,
  selectedKey,
}: {
  points: ChartPoint[];
  loading?: boolean;
  className?: string;
  height?: string;
  /** Shade the selected period from this slot to Today */
  periodFromKey?: string;
  /** Mark one slot (e.g. the table row being analysed) */
  selectedKey?: string;
}) {
  const { M, C } = useMoney();
  const estimatedShown = points.filter((p) => p.quality === 'estimated').length;
  const breaks = points.filter((p) => p.coverageBreak);
  const hasData = points.filter((p) => p.netWorth != null).length;

  const yDomain = useMemo(() => {
    const vals = points.map((p) => p.netWorth).filter((v): v is number => v != null);
    if (!vals.length) return [0, 1];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = hi - lo > 0 ? (hi - lo) * 0.12 : Math.max(Math.abs(hi) * 0.05, 1);
    return [lo - pad, hi + pad];
  }, [points]);

  return (
    <>
      <div className={cn(height, 'flex-1', className)} role="img" aria-label={chartSummary(points, C)}>
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : hasData < 2 ? (
          <p className="pt-10 text-[13.5px] text-muted">The trend appears once a month-end snapshot exists for this period (Trends &amp; analysis → Monthly snapshots).</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-divider)" />
              <XAxis
                dataKey="key"
                tickFormatter={(k: string) => points.find((p) => p.key === k)?.label ?? ''}
                interval="preserveStartEnd"
                minTickGap={10}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-neutral-600)', fontSize: 12 }}
              />
              <YAxis domain={yDomain} tickCount={4} tickFormatter={(v: number) => C(v)} width={64} axisLine={false} tickLine={false} tick={{ fill: 'var(--color-neutral-600)', fontSize: 11.5 }} />
              <Tooltip cursor={{ stroke: 'var(--color-divider)' }} content={<PointTooltip M={M} />} />
              {periodFromKey && points.some((p) => p.key === periodFromKey) && <ReferenceArea x1={periodFromKey} x2="today" fill="var(--color-accent)" fillOpacity={0.06} />}
              {selectedKey && points.some((p) => p.key === selectedKey) && <ReferenceLine x={selectedKey} stroke="var(--color-accent)" strokeOpacity={0.5} />}
              {breaks.map((b) => (
                <ReferenceLine key={b.key} x={b.key} stroke="var(--fin-warn)" strokeDasharray="2 3" />
              ))}
              <Line dataKey="solid" stroke="var(--color-accent)" strokeWidth={2} dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="dashed" stroke="var(--color-accent)" strokeWidth={1.6} strokeDasharray="5 4" dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="netWorth" stroke="transparent" dot={<PointDot />} activeDot={{ r: 5, fill: 'var(--color-accent)' }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {!loading && hasData >= 2 && (estimatedShown > 0 || breaks.length > 0 || points.some((p) => p.netWorth == null) || periodFromKey) && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
          {periodFromKey && <span>shaded: selected period</span>}
          {estimatedShown > 0 && <span>╌ hollow points: estimated</span>}
          {points.some((p) => p.netWorth == null) && <span>gaps: no snapshot that month</span>}
          {breaks.length > 0 && <span className="text-warn">┆ a new asset or loan type appears — likely newly tracked, not growth</span>}
        </p>
      )}
    </>
  );
}

function chartSummary(points: ChartPoint[], C: (v: number) => string) {
  const vals = points.filter((p) => p.netWorth != null);
  if (vals.length < 2) return 'Net worth trend: not enough history';
  const first = vals[0];
  return `Net worth trend from ${first.label} (${C(first.netWorth!)}) to today (${C(vals[vals.length - 1].netWorth!)})`;
}

/** Filled dot = recorded, hollow = estimated, larger = today */
function PointDot(props: { cx?: number; cy?: number; payload?: ChartPoint }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload || payload.netWorth == null) return <g />;
  if (payload.live) return <circle cx={cx} cy={cy} r={4.5} fill="var(--color-accent)" stroke="var(--panel-bg)" strokeWidth={1.5} />;
  const est = payload.quality === 'estimated';
  return <circle cx={cx} cy={cy} r={3.5} fill={est ? 'var(--panel-bg)' : 'var(--color-accent)'} stroke="var(--color-accent)" strokeWidth={1.6} strokeDasharray={est ? '2 1.5' : undefined} />;
}

function PointTooltip({ active, payload, M }: { active?: boolean; payload?: { payload: ChartPoint }[]; M: (v: number | null) => string }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-[12.5px] shadow-md" style={{ background: 'var(--dialog-bg)', color: 'var(--color-text)' }}>
      <div className="font-semibold">{p.live ? `Today · ${fmtDate(p.date)} · partial month` : `${fmtDate(p.date)} · month-end`}</div>
      {p.netWorth == null ? (
        <div className="mt-1 text-muted">No snapshot saved for this month</div>
      ) : (
        <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
          <dt className="text-muted">Net worth</dt>
          <dd className="text-right font-semibold">{M(p.netWorth)}</dd>
          <dt className="text-muted">Assets</dt>
          <dd className="text-right">{M(p.assets)}</dd>
          <dt className="text-muted">Liabilities</dt>
          <dd className="text-right">{M(p.liabilities)}</dd>
        </dl>
      )}
      {p.netWorth != null && (
        <div className="mt-1 text-[12px] text-muted">
          {p.live ? 'Current balances (each as of its own date)' : p.quality === 'estimated' && p.reason ? ESTIMATE_TEXT[p.reason] : 'Recorded at month-end'}
          {p.computedAt && !p.live && p.quality === 'estimated' && ` (saved ${fmtDate(p.computedAt)})`}
        </div>
      )}
      {p.coverageBreak && <div className="mt-1 text-[12px] text-warn">A new asset or loan type appears here — likely newly tracked accounts rather than growth</div>}
    </div>
  );
}
