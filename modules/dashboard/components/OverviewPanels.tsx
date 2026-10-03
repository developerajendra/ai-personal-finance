'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Amount, Dot, IconTile, Panel, PanelHeader, PanelLink, StackBar, Tag, type Tone } from '@/shared/components/ui';
import { useMoney, pct, fmtDate } from '@/shared/hooks/useMoney';
import type { AssetClass } from '@/shared/hooks/usePortfolioTotals';
import type { HealthCheck, LadderRung } from '@/shared/utils/insights';
import type { CashEvent } from '@/shared/utils/upcoming';

/* ------------------------------------------------------------ Allocation */

export function AllocationPanel({ classes, assets }: { classes: AssetClass[]; assets: number }) {
  const { C } = useMoney();
  const sorted = [...classes].filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
  return (
    <Panel>
      <PanelHeader title="Allocation" action={<PanelLink href="/portfolio">Portfolio</PanelLink>} />
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative h-[150px] w-[150px] flex-none">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={sorted} dataKey="value" nameKey="label" innerRadius={44} outerRadius={72} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
                {sorted.map((c) => (
                  <Cell key={c.key} fill={c.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[12px] text-muted">Assets</span>
            <span className="text-[15px] font-bold">{C(assets)}</span>
          </div>
        </div>
        <ul className="min-w-[160px] flex-1 space-y-2.5">
          {sorted.map((c) => (
            <li key={c.key}>
              <Link href={c.href} className="flex items-center gap-2.5 text-[14px] hover:text-accent-700">
                <Dot color={c.color} size={9} />
                <span className="flex-1">{c.label}</span>
                <span className="tabular-nums text-muted">{pct(c.share)}</span>
              </Link>
            </li>
          ))}
          {sorted.length === 0 && <li className="text-[14px] text-muted">No published holdings yet.</li>}
        </ul>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------- Stat card */

export function StatCard({
  icon,
  label,
  value,
  sub,
  subTone = 'muted',
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  subTone?: Tone | 'muted';
  href?: string;
}) {
  const body = (
    <>
      <IconTile icon={icon} />
      <div className="mt-4 text-[13.5px] text-muted">{label}</div>
      <div className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.02em]">{value}</div>
      {sub && <div className={cn('mt-2 text-[13px]', { gain: 'text-gain', loss: 'text-loss', warn: 'text-warn', accent: 'text-accent-700', neutral: 'text-ink', muted: 'text-muted' }[subTone])}>{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="panel panel-lift block px-6 py-[22px]">
      {body}
    </Link>
  ) : (
    <Panel>{body}</Panel>
  );
}

/* --------------------------------------------------------- Health checks */

export function HealthPanel({ checks }: { checks: HealthCheck[] }) {
  const healthy = checks.filter((c) => c.healthy).length;
  return (
    <Panel>
      <PanelHeader title="Financial health" action={<span className="text-[13px] text-muted">{healthy} of {checks.length} healthy</span>} />
      {checks.length === 0 ? (
        <p className="text-[14px] text-muted">Add transactions and holdings to see health ratios.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {checks.map((c) => (
            <div key={c.key} className="rounded-[14px] bg-tile px-4 py-3.5">
              <div className="text-[13px] text-muted">{c.label}</div>
              <div className="mt-1.5 text-[19px] font-bold tracking-[-0.01em]">{c.value}</div>
              <Tag tone={c.tone === 'neutral' ? 'neutral' : c.tone} className={`mt-2 font-semibold ${c.tone === 'neutral' ? '!bg-panel' : ''}`}>
                {c.verdict}
              </Tag>
              <p className="mt-2 text-[12.5px] leading-snug text-muted">{c.note}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------- Needs attention */

export interface AttentionItem {
  key: string;
  title: string;
  body: string;
  tone: 'loss' | 'warn' | 'neutral';
  href: string;
}

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  const tile = { loss: 'bg-loss-bg', warn: 'bg-warn-bg', neutral: 'bg-tile' };
  return (
    <Panel>
      <PanelHeader title="Needs attention" />
      {items.length === 0 ? (
        <p className="text-[14px] text-muted">Nothing needs your attention right now.</p>
      ) : (
        <ul>
          {items.map((it) => (
            <li key={it.key} className="border-b border-divider last:border-0">
              <Link href={it.href} className="flex gap-3.5 py-3.5 hover:opacity-80">
                <span className={cn('mt-0.5 h-7 w-7 flex-none rounded-[8px]', tile[it.tone])} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold">{it.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">{it.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------- Liquidity ladder */

export function LadderPanel({ rungs, assets }: { rungs: LadderRung[]; assets: number }) {
  const { M } = useMoney();
  const reach90 = rungs.slice(0, 3).reduce((s, r) => s + r.value, 0);
  return (
    <Panel>
      <PanelHeader title="Liquidity ladder" subtitle={`${M(reach90)} (${pct(assets ? (reach90 / assets) * 100 : 0, 0)} of assets) reachable within 90 days`} />
      <StackBar segments={rungs.map((r) => ({ value: r.value, color: r.color, label: r.label }))} height={10} />
      <ul className="mt-4">
        {rungs.map((r) => (
          <li key={r.key} className="flex items-start gap-3 border-b border-divider py-3 last:border-0">
            <Dot color={r.color} size={9} className="mt-1.5" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px]">{r.label}</span>
              <span className="block text-[12.5px] text-muted">{r.note}</span>
            </span>
            <span className="text-right text-[14px] tabular-nums">{M(r.value)}</span>
            <span className="w-14 text-right text-[13px] tabular-nums text-muted">{pct(assets ? (r.value / assets) * 100 : 0)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* --------------------------------------------------------- Next 90 days */

export function EventDateTile({ date, late }: { date: string; late?: boolean }) {
  const d = new Date(date);
  return (
    <span className="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-[10px] bg-tile leading-none">
      {late ? (
        <>
          <span className="text-[10px] font-bold uppercase tracking-wide text-loss">Late</span>
          <span className="mt-1 text-[15px] font-bold">!</span>
        </>
      ) : (
        <>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{d.toLocaleString('en-GB', { month: 'short' })}</span>
          <span className="mt-1 text-[16px] font-bold">{d.getDate()}</span>
        </>
      )}
    </span>
  );
}

export function NextDaysPanel({ overdue, upcoming }: { overdue: CashEvent[]; upcoming: CashEvent[] }) {
  const { S } = useMoney();
  const rows = [...overdue.map((e) => ({ ...e, late: true })), ...upcoming.map((e) => ({ ...e, late: false }))].slice(0, 7);
  return (
    <Panel>
      <PanelHeader title="Next 90 days" action={<PanelLink href="/upcoming">Calendar</PanelLink>} />
      {rows.length === 0 ? (
        <p className="text-[14px] text-muted">No EMIs, maturities or receivables due in the next 90 days.</p>
      ) : (
        <ul>
          {rows.map((e) => (
            <li key={e.id} className="border-b border-divider last:border-0">
              <Link href={e.href} className="flex items-center gap-3.5 py-3 hover:opacity-80">
                <EventDateTile date={e.date} late={e.late} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px]">{e.title}</span>
                  <span className="block truncate text-[12.5px] text-muted">{e.sub}</span>
                </span>
                <Amount value={e.amount} className="text-[14.5px] font-semibold" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* --------------------------------------------------------- Balance sheet */

export function BalanceSheetPanel({ classes, assets, liabilities, netWorth }: { classes: AssetClass[]; assets: number; liabilities: number; netWorth: number }) {
  const { M } = useMoney();
  const [explain, setExplain] = useState(false);
  const sorted = [...classes].sort((a, b) => b.value - a.value);
  return (
    <Panel>
      <PanelHeader title="Balance sheet" action={<PanelLink onClick={() => setExplain(!explain)}>How net worth is calculated</PanelLink>} />
      {explain && (
        <p className="mb-3 rounded-[12px] bg-tile px-4 py-3 text-[13px] leading-relaxed text-muted">
          Net worth = every published asset at its current value (bank balances, deposits at their rule-based value, Zerodha holdings at last price, EPF/PPF balances, property estimates, receivables with agreed interest) minus outstanding loans. Drafts and closed records are excluded.
        </p>
      )}
      <ul>
        {sorted.map((c) => (
          <li key={c.key} className="flex items-center gap-3 border-b border-divider py-3">
            <Dot color={c.color} size={9} />
            <Link href={c.href} className="flex-1 text-[14.5px] hover:text-accent-700">
              {c.label}
            </Link>
            <span className="text-[14px] tabular-nums">{M(c.value)}</span>
            <span className="w-14 text-right text-[13px] tabular-nums text-muted">{pct(c.share)}</span>
          </li>
        ))}
        <li className="flex items-center gap-3 border-b border-divider py-3">
          <Dot color="var(--c-loan)" size={9} />
          <Link href="/portfolio/loans" className="flex-1 text-[14.5px] hover:text-accent-700">
            Loans (liability)
          </Link>
          <span className="text-[14px] tabular-nums text-loss">{M(-liabilities)}</span>
          <span className="w-14 text-right text-[13px] tabular-nums text-muted">{pct(assets ? (liabilities / assets) * 100 : 0)}</span>
        </li>
      </ul>
      <div className="flex items-center justify-between pt-4">
        <span className="text-[16px] font-semibold">Net worth</span>
        <span className="text-[19px] font-bold tabular-nums">{M(netWorth)}</span>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------- Data freshness */

export interface FreshnessRow {
  label: string;
  source: string;
  status: string;
  tone: Tone;
  when: string;
}

export function FreshnessPanel({ rows }: { rows: FreshnessRow[] }) {
  return (
    <Panel>
      <PanelHeader title="Data freshness" />
      <ul>
        {rows.map((r) => (
          <li key={r.label} className="flex items-start justify-between gap-3 py-2.5">
            <span>
              <span className="block text-[14.5px]">{r.label}</span>
              <span className="block text-[12.5px] text-muted">{r.source}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <Tag tone={r.tone} className="font-semibold">
                {r.status}
              </Tag>
              <span className="text-[12.5px] text-muted">{r.when}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <PanelLink href="/settings">Manage connections</PanelLink>
      </div>
    </Panel>
  );
}

/** Freshness verdict from the age of the newest/oldest record. */
export function freshness(iso: string | undefined | null, staleAfterDays = 45): { status: string; tone: Tone; when: string } {
  if (!iso) return { status: 'No data', tone: 'neutral', when: '—' };
  const age = (Date.now() - new Date(iso).getTime()) / 864e5;
  if (age <= staleAfterDays / 3) return { status: 'Current', tone: 'gain', when: fmtDate(iso) };
  if (age <= staleAfterDays) return { status: 'Partly stale', tone: 'warn', when: fmtDate(iso) };
  return { status: 'Stale', tone: 'loss', when: fmtDate(iso) };
}
