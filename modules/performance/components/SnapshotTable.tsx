'use client';

import { Fragment, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Dot, Panel, Segmented, Tag } from '@/shared/components/ui';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { cn } from '@/shared/utils/cn';
import { ASSET_CLASSES, CLASS_LABELS, MATERIAL_SHARE, type ClassKey, type EstimateReason, type Observation, type TableRow } from '@/shared/utils/netWorthHistory';
import { CLASS_COLORS } from './PeriodReconciliation';

const REASON: Record<EstimateReason, string> = {
  rebuilt: 'Estimated · rebuilt later',
  early: 'Estimated · saved before month-end',
  'unknown-date': 'Estimated · save date unknown',
  inconsistent: 'Estimated · totals don’t add up',
  empty: 'Empty save · nothing tracked',
};

export const rowLabel = (r: TableRow, mode: 'Monthly' | 'Yearly') =>
  r.live ? 'Today' : mode === 'Yearly' ? String(r.date.getFullYear()) : r.date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

function quality(o: Observation | null, live: boolean) {
  if (live) return { text: 'Partial month · current balances', tone: 'accent' as const };
  if (!o) return { text: 'No snapshot', tone: 'neutral' as const };
  if (o.quality === 'recorded') return { text: `Recorded${o.computedAt ? ` · saved ${fmtDate(o.computedAt)}` : ''}`, tone: 'gain' as const };
  return { text: REASON[o.reason ?? 'rebuilt'], tone: 'warn' as const };
}

/** 4. Month-by-month (or year-end) table with selection and drill-down into every save. */
export function SnapshotTable({
  rows,
  mode,
  onMode,
  selected,
  onSelect,
  periodFrom,
}: {
  rows: TableRow[];
  mode: 'Monthly' | 'Yearly';
  onMode: (m: 'Monthly' | 'Yearly') => void;
  selected: string;
  onSelect: (key: string) => void;
  /** Rows dated on/after this are inside the selected period */
  periodFrom: Date | null;
}) {
  const { M, C, S } = useMoney();
  const [exact, setExact] = useState(false);
  const [cols, setCols] = useState<'Summary' | 'All categories'>('Summary');
  const [open, setOpen] = useState<string | null>(null);
  const F = exact ? (v: number) => M(v) : C;
  const keys: (ClassKey | 'netWorth' | 'assets')[] = cols === 'Summary' ? ['netWorth', 'assets', 'loans'] : ['netWorth', ...ASSET_CLASSES, 'loans'];
  const label = (k: (typeof keys)[number]) => (k === 'netWorth' ? 'Net worth' : k === 'assets' ? 'Total assets' : CLASS_LABELS[k]);
  const value = (o: Observation, k: (typeof keys)[number]) => (k === 'netWorth' ? o.netWorth : k === 'assets' ? o.assets : o.classes[k]);

  return (
    <Panel flush className="mt-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pb-4 pt-[22px]">
        <div>
          <h2 className="text-[19px]">{mode === 'Monthly' ? 'Month by month' : 'Year by year'}</h2>
          <p className="mt-1 text-[13px] text-muted">
            Newest first · each change is against the latest earlier {mode === 'Monthly' ? 'month' : 'year-end'} with data · select a row to analyse it above
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented value={mode} onChange={onMode} options={['Monthly', 'Yearly']} ariaLabel="Interval" />
          <Segmented value={cols} onChange={setCols} options={['Summary', 'All categories']} ariaLabel="Columns" />
          <Segmented value={exact ? 'Exact' : 'Short'} onChange={(v) => setExact(v === 'Exact')} options={['Short', 'Exact']} ariaLabel="Number format" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table" style={{ minWidth: cols === 'Summary' ? 560 : 1100 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-[2] !bg-panel !pl-6">{mode === 'Monthly' ? 'Month' : 'Year'}</th>
              {keys.map((k) => (
                <th key={k} className={cn('num', k === 'netWorth' && 'bg-accent-100')}>
                  <span className="inline-flex items-center gap-1.5">
                    {k !== 'netWorth' && k !== 'assets' && <Dot color={CLASS_COLORS[k]} size={8} />}
                    {label(k)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const q = quality(r.obs, r.live);
              const on = r.key === selected;
              const inPeriod = periodFrom != null && r.date.getTime() >= periodFrom.getTime();
              const usable = r.obs && r.obs.reason !== 'empty';
              const gross = r.obs ? r.obs.assets + r.obs.liabilities : 0;
              const saves = r.obs && !r.live ? [r.obs, ...r.obs.alternates] : [];
              return (
                <Fragment key={r.key}>
                  <tr
                    onClick={() => usable && onSelect(r.key)}
                    aria-selected={on}
                    className={cn(usable && 'cursor-pointer', on && '[&>td]:!bg-tile', !usable && 'text-muted')}>
                    <td className={cn('sticky left-0 z-[1] !bg-panel !pl-6', on && '!bg-tile', inPeriod && 'shadow-[inset_3px_0_0_var(--color-accent)]')}>
                      <div className="flex items-center gap-1.5 text-[15px] font-semibold">
                        {rowLabel(r, mode)}
                        {on && <span className="sr-only">(selected)</span>}
                        {inPeriod && <span className="sr-only">(in selected period)</span>}
                      </div>
                      <Tag tone={q.tone} className="mt-1 !text-[11.5px]">
                        {q.text}
                      </Tag>
                      {r.obs?.conflict && <span className="mt-1 block text-[12px] text-warn">Saves disagree</span>}
                      {saves.length > 1 && (
                        <button
                          type="button"
                          aria-expanded={open === r.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(open === r.key ? null : r.key);
                          }}
                          className="mt-1 flex items-center gap-1 text-[12px] font-medium text-accent-700 hover:underline">
                          <ChevronDown className={cn('h-3 w-3', open === r.key && 'rotate-180')} aria-hidden /> {saves.length} saves
                        </button>
                      )}
                    </td>
                    {keys.map((k) => {
                      if (!usable) return <td key={k} className="num">—</td>;
                      const v = value(r.obs!, k);
                      const p = r.prev ? value(r.prev, k) : null;
                      const d = p == null ? null : v - p;
                      const good = d == null ? null : k === 'loans' ? d < 0 : d > 0;
                      const appears = k !== 'netWorth' && k !== 'assets' && p === 0 && v > 0 && v >= MATERIAL_SHARE * gross;
                      return (
                        <td key={k} className={cn('num', k === 'netWorth' && 'bg-accent-100 font-semibold')}>
                          <div className="text-[14.5px] tabular-nums">{F(v)}</div>
                          <div className={cn('mt-0.5 text-[12px] tabular-nums', d == null || Math.abs(d) < 0.5 ? 'text-muted' : good ? 'text-gain' : 'text-loss')}>
                            {appears ? <span className="text-warn">new · {S(d!, { compact: !exact })}</span> : d == null ? '—' : Math.abs(d) < 0.5 ? '0' : S(d, { compact: !exact })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {open === r.key && (
                    <tr>
                      <td colSpan={keys.length + 1} className="!bg-tile !pl-6">
                        <p className="text-[12.5px] font-semibold">Every save for {rowLabel(r, mode)}</p>
                        <ul className="mt-1 space-y-0.5 text-[12.5px]">
                          {saves.map((o, i) => (
                            <li key={o.id + i} className="tabular-nums">
                              {o.computedAt ? o.computedAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'unknown time'} ·{' '}
                              {o.reason === 'empty' ? 'empty' : M(o.netWorth)} · {o.quality === 'recorded' ? 'recorded' : REASON[o.reason ?? 'rebuilt']}
                              {i === 0 ? ' · used' : ''}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-[12px] text-muted">The used save is the first recorded one, else the latest; others are kept here, not discarded.</p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-6 py-3 text-[12px] text-muted">
        <span className="mr-1 inline-block h-3 w-[3px] bg-accent align-middle" aria-hidden /> marks rows in the selected period. “new” marks a category that was empty in the compared
        row — likely newly tracked rather than growth. Changes in Loans are balance changes; a fall is good for net worth.
      </p>
    </Panel>
  );
}
