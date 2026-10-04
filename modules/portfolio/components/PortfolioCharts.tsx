'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Panel, PanelHeader, Skeleton } from '@/shared/components/ui';
import { useMoney, monthShort } from '@/shared/hooks/useMoney';
import { useSnapshots } from '@/shared/hooks/useSnapshots';
import type { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';
import { BarsPanel, DonutPanel } from './ClassCharts';

type Totals = ReturnType<typeof usePortfolioTotals>;

const tooltipStyle = { background: 'var(--dialog-bg)', border: 0, borderRadius: 12, boxShadow: 'var(--shadow-md)', color: 'var(--color-text)', fontSize: 13 };

/**
 * Portfolio overview charts: allocation by asset class (legend rows open each class page)
 * and net worth over the last 12 month-end snapshots plus today.
 */
export function PortfolioCharts({ t }: { t: Totals }) {
  const slices = t.classes.map((c) => ({ name: c.label, value: c.value, color: c.color, href: c.href }));
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <DonutPanel title="Allocation" subtitle="Share of assets by class · tap one to open it" slices={slices} centreLabel="Assets" />
      <NetWorthTrend t={t} />
    </div>
  );
}

function NetWorthTrend({ t }: { t: Totals }) {
  const { M } = useMoney();
  const { monthly, isLoading } = useSnapshots();

  const points = useMemo(() => {
    const now = new Date();
    const past = monthly.filter((s) => s.year < now.getFullYear() || (s.year === now.getFullYear() && (s.month ?? 0) < now.getMonth() + 1)).slice(-12);
    return [
      ...past.map((s) => ({ label: `${monthShort(s.month ?? 12)}${s.month === 1 ? ` ’${String(s.year).slice(2)}` : ''}`, netWorth: s.netWorth, liabilities: s.totalLoans })),
      { label: 'Today', netWorth: t.netWorth, liabilities: t.liabilities },
    ];
  }, [monthly, t.netWorth, t.liabilities]);

  if (isLoading) {
    return (
      <Panel className="h-full">
        <PanelHeader title="Net worth trend" />
        <Skeleton className="h-[220px] w-full" />
      </Panel>
    );
  }

  // Not enough history yet: show today's balance sheet instead of a one-point line
  if (points.length < 2) {
    return (
      <BarsPanel
        title="Assets vs liabilities"
        subtitle={
          <>
            Today · the trend appears after the first month-end snapshot (
            <Link href="/performance/snapshots" className="text-accent-700 hover:underline">
              Monthly snapshots
            </Link>
            )
          </>
        }
        rows={[
          { name: 'Assets', value: t.assets, color: 'var(--color-accent)' },
          { name: 'Liabilities', value: t.liabilities, color: 'var(--fin-loss)' },
          { name: 'Net worth', value: t.netWorth, color: 'var(--fin-gain)' },
        ]}
        series={[{ key: 'value', label: 'Value', color: 'var(--color-accent)' }]}
        colorKey="color"
      />
    );
  }

  return (
    <Panel className="h-full">
      <PanelHeader title="Net worth trend" subtitle="Month-end snapshots and today" />
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="pfNw" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-neutral-600)', fontSize: 12 }} interval="preserveStartEnd" padding={{ left: 10, right: 14 }} />
            <YAxis hide domain={[0, 'dataMax']} />
            <Tooltip cursor={{ stroke: 'var(--color-divider)' }} contentStyle={tooltipStyle} formatter={(v: number, n: string) => [M(v), n]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12.5, paddingTop: 4 }} />
            <Area
              type="linear"
              dataKey="netWorth"
              name="Net worth"
              stroke="var(--color-accent)"
              strokeWidth={2}
              fill="url(#pfNw)"
              dot={{ r: 3, fill: 'var(--panel-bg)', stroke: 'var(--color-accent)', strokeWidth: 1.6 }}
              isAnimationActive={false}
            />
            <Line type="linear" dataKey="liabilities" name="Liabilities" stroke="var(--fin-loss)" strokeWidth={1.6} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
