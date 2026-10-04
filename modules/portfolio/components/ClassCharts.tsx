'use client';

import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dot, Panel, PanelHeader } from '@/shared/components/ui';
import { useMoney, pct } from '@/shared/hooks/useMoney';

/** Categorical series colours, in the order a class page assigns them. */
export const SERIES_COLORS = ['var(--color-accent)', 'var(--c-dep)', 'var(--c-ret)', 'var(--c-prop)', 'var(--c-cash)', 'var(--c-recv)'];

const tooltipStyle = {
  background: 'var(--dialog-bg)',
  border: 0,
  borderRadius: 12,
  boxShadow: 'var(--shadow-md)',
  color: 'var(--color-text)',
  fontSize: 13,
};
const axisTick = { fill: 'var(--color-neutral-600)', fontSize: 12 };
/** Short axis labels (₹75L, ₹1.2Cr) so ticks never wrap. */
const axisMoney = (v: number) => {
  const a = Math.abs(v);
  const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (a >= 1e7) return `₹${trim(v / 1e7)}Cr`;
  if (a >= 1e5) return `₹${trim(v / 1e5)}L`;
  if (a >= 1e3) return `₹${trim(v / 1e3)}K`;
  return `₹${v}`;
};

export interface Slice {
  name: string;
  value: number;
  color: string;
}

/** Donut with a centre total and a legend list — same treatment as the dashboard's Allocation panel. */
export function DonutPanel({ title, subtitle, slices, centreLabel, action }: { title: string; subtitle?: ReactNode; slices: Slice[]; centreLabel: string; action?: ReactNode }) {
  const { M, C } = useMoney();
  const data = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Panel className="h-full">
      <PanelHeader title={title} subtitle={subtitle} action={action} />
      {data.length === 0 ? (
        <p className="text-[14px] text-muted">Nothing to chart yet.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative h-[150px] w-[150px] flex-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [M(v), n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[12px] text-muted">{centreLabel}</span>
              <span className="text-[15px] font-bold">{C(total)}</span>
            </div>
          </div>
          <ul className="min-w-[160px] flex-1 space-y-2.5">
            {data.map((d) => (
              <li key={d.name} className="flex items-center gap-2.5 text-[14px]">
                <Dot color={d.color} size={9} />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                <span className="tabular-nums">{C(d.value)}</span>
                <span className="w-12 text-right tabular-nums text-muted">{pct(total ? (d.value / total) * 100 : 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

/** Vertical bars per category; `stacked` stacks the series (e.g. invested + growth). */
export function BarsPanel({
  title,
  subtitle,
  rows,
  series,
  stacked,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  rows: Record<string, string | number>[];
  series: BarSeries[];
  stacked?: boolean;
  action?: ReactNode;
}) {
  const { M } = useMoney();
  return (
    <Panel className="h-full">
      <PanelHeader title={title} subtitle={subtitle} action={action} />
      {rows.length === 0 ? (
        <p className="text-[14px] text-muted">Nothing to chart yet.</p>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--color-divider)" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={axisTick}
                interval={0}
                tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
              />
              <YAxis axisLine={false} tickLine={false} tick={axisTick} width={52} tickFormatter={axisMoney} />
              <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--color-text) 5%, transparent)' }} contentStyle={tooltipStyle} formatter={(v: number, n: string) => [M(v), n]} />
              {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12.5, paddingTop: 6 }} />}
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  stackId={stacked ? 'a' : undefined}
                  radius={stacked && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
                  maxBarSize={44}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

/**
 * Sum values by name, keep the largest `max` and fold the rest into "Others", then colour them —
 * donut slices are keyed by name, so duplicates must be merged first.
 */
export function toSlices(items: { name: string; value: number }[], max = SERIES_COLORS.length - 1): Slice[] {
  const totals = new Map<string, number>();
  for (const { name, value } of items) if (value > 0) totals.set(name, (totals.get(name) || 0) + value);
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, max);
  const rest = sorted.slice(max).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) top.push(['Others', rest]);
  return top.map(([name, value], i) => ({ name, value, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
}
