'use client';

import { CheckCircle2, AlertTriangle, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Dot, Panel, PanelHeader } from '@/shared/components/ui';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import type { useNetWorthPeriod } from '@/shared/hooks/useNetWorthPeriod';
import { cn } from '@/shared/utils/cn';
import { CLASS_LABELS, contributions, rangeLabel, type ClassKey, type Contribution, type RangeKey } from '@/shared/utils/netWorthHistory';

type Period = ReturnType<typeof useNetWorthPeriod>;

export const CLASS_COLORS: Record<ClassKey, string> = {
  bank: 'var(--c-cash)',
  stocks: 'var(--c-stock)',
  pf: 'var(--c-ret)',
  property: 'var(--c-prop)',
  recv: 'var(--c-recv)',
  fd: 'var(--c-dep)',
  investments: 'var(--c-fund)',
  loans: 'var(--c-loan)',
};

const tone = (v: number) => (Math.abs(v) < 0.5 ? 'text-ink' : v > 0 ? 'text-gain' : 'text-loss');
const Arrow = ({ v }: { v: number }) =>
  Math.abs(v) < 0.5 ? <Minus className="h-4 w-4" aria-hidden /> : v > 0 ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />;

function Kpi({ label, value, sub, valueClass, title }: { label: string; value: React.ReactNode; sub: React.ReactNode; valueClass?: string; title?: string }) {
  return (
    <Panel>
      <div className="eyebrow" title={title}>
        {label}
      </div>
      <div className={cn('mt-2.5 flex items-center gap-1.5 break-words text-[22px] font-bold tracking-[-0.02em]', valueClass)}>{value}</div>
      <div className="mt-2 text-[13px] text-muted">{sub}</div>
    </Panel>
  );
}

/** 1. Selected-period wealth summary */
export function WealthSummary({ period, range }: { period: Period; range: RangeKey }) {
  const { M, S } = useMoney();
  const { cmp, coverage, live, now } = period;
  const rows = cmp.status === 'ok' ? contributions(cmp.opening, cmp.closing, coverage).rows : [];
  const up = [...rows].filter((r) => r.contribution > 0.5).sort((a, b) => b.contribution - a.contribution)[0];
  const down = [...rows].filter((r) => r.contribution < -0.5).sort((a, b) => a.contribution - b.contribution)[0];
  const comparable = coverage.length === 0;
  const def = "A category's contribution is its effect on net worth: an asset rising or a loan falling adds; an asset falling or a loan rising subtracts.";
  const contribSub = (r: Contribution | undefined) =>
    !r ? (cmp.status === 'ok' ? 'None in this period' : 'Needs a comparison point') : r.newlyTracked ? `${S(r.newlyTracked, { compact: true })} of it newly tracked, not growth` : r.cls === 'loans' ? `Loan balance ${r.balanceChange < 0 ? 'fell' : 'rose'}` : 'Balance change';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Net worth · today" value={M(live.netWorth)} sub={`${fmtDate(now)} · partial month`} />
      {cmp.status === 'ok' ? (
        <Kpi
          label={`Change · ${rangeLabel(range)}`}
          value={
            <>
              {comparable ? <Arrow v={cmp.change} /> : <AlertTriangle className="h-4 w-4 text-warn" aria-hidden />}
              {S(cmp.change, { compact: true })}
            </>
          }
          valueClass={comparable ? tone(cmp.change) : 'text-ink'}
          sub={
            <>
              vs {fmtDate(cmp.opening.date)}
              {comparable && cmp.pct != null && ` · ${cmp.pct >= 0 ? '+' : '−'}${Math.abs(cmp.pct).toFixed(1)}%`}
              {!comparable && <span className="block text-warn">Not like-for-like: includes newly tracked accounts</span>}
              {comparable && cmp.pct == null && <span className="block">No %: opening net worth was {cmp.opening.netWorth < 0 ? 'negative' : 'zero'}</span>}
            </>
          }
        />
      ) : (
        <Kpi
          label={`Change · ${rangeLabel(range)}`}
          value={
            <>
              <Minus className="h-4 w-4 text-muted" aria-hidden /> Insufficient history
            </>
          }
          valueClass="text-ink !text-[18px]"
          sub={cmp.reason === 'only-estimates' ? 'Saved values for this period were rebuilt later, not recorded' : 'No month-end snapshot for this period'}
        />
      )}
      <Kpi
        label="Largest positive contribution"
        title={def}
        value={up ? CLASS_LABELS[up.cls] : '—'}
        sub={
          <>
            {up && <span className="font-semibold text-gain">{S(up.contribution, { compact: true })} · </span>}
            {contribSub(up)}
          </>
        }
      />
      <Kpi
        label="Largest negative contribution"
        title={def}
        value={down ? CLASS_LABELS[down.cls] : '—'}
        sub={
          <>
            {down && <span className="font-semibold text-loss">{S(down.contribution, { compact: true })} · </span>}
            {contribSub(down)}
          </>
        }
      />
    </div>
  );
}

/** Opening → category contributions → closing, as a bridge with divergent bars (one row per step). */
export function ContributionBridge({
  rows,
  opening,
  closing,
  openingLabel,
  closingLabel,
  residual,
}: {
  rows: Contribution[];
  opening: number;
  closing: number;
  openingLabel: string;
  closingLabel: string;
  residual: number;
}) {
  const { M, S } = useMoney();
  const moving = rows.filter((r) => Math.abs(r.contribution) >= 0.5);
  const still = rows.filter((r) => Math.abs(r.contribution) < 0.5);
  const max = Math.max(1, ...moving.map((r) => Math.abs(r.contribution)), Math.abs(residual));
  let running = opening;
  const bar = (v: number) => (
    <span className="relative block h-2.5 w-full" aria-hidden>
      <span className="absolute inset-y-0 left-1/2 w-px bg-divider" />
      <span
        className={cn('absolute inset-y-0 rounded-sm', v >= 0 ? 'bg-gain' : 'bg-loss')}
        style={v >= 0 ? { left: '50%', width: `${(v / max) * 50}%` } : { right: '50%', width: `${(-v / max) * 50}%` }}
      />
    </span>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-[13.5px]">
        <caption className="sr-only">Opening net worth, each category&apos;s contribution, and closing net worth</caption>
        <thead>
          <tr className="text-left text-[12.5px] text-muted">
            <th className="py-1.5 font-medium">Step</th>
            <th className="w-[34%] py-1.5 font-medium">
              <span className="sr-only">Bar</span>
            </th>
            <th className="py-1.5 text-right font-medium">Contribution</th>
            <th className="py-1.5 text-right font-medium">Running total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-divider font-semibold">
            <td className="py-2">Opening · {openingLabel}</td>
            <td />
            <td />
            <td className="py-2 text-right tabular-nums">{M(opening)}</td>
          </tr>
          {moving.map((r) => {
            running += r.contribution;
            return (
              <tr key={r.cls} className="border-t border-divider">
                <td className="py-2">
                  <span className="inline-flex items-center gap-2">
                    <Dot color={CLASS_COLORS[r.cls]} size={8} /> {CLASS_LABELS[r.cls]}
                    {r.contribution > 0 ? <TrendingUp className="h-3.5 w-3.5 text-gain" aria-label="adds" /> : <TrendingDown className="h-3.5 w-3.5 text-loss" aria-label="subtracts" />}
                  </span>
                  {r.cls === 'loans' && (
                    <span className="block pl-4 text-[12px] text-muted">
                      Balance {r.balanceChange > 0 ? 'rose' : 'fell'} {M(Math.abs(r.balanceChange))} — {r.balanceChange > 0 ? 'more owed' : 'less owed'}
                    </span>
                  )}
                  {r.firstAppears && <span className="block pl-4 text-[12px] text-warn">Empty at the opening — first appears</span>}
                </td>
                <td className="px-2">{bar(r.contribution)}</td>
                <td className={cn('py-2 text-right tabular-nums', tone(r.contribution))}>{S(r.contribution)}</td>
                <td className="py-2 text-right tabular-nums text-muted">{M(running)}</td>
              </tr>
            );
          })}
          {Math.abs(residual) >= 0.5 && (
            <tr className="border-t border-divider">
              <td className="py-2 text-warn">Unresolved difference</td>
              <td className="px-2">{bar(residual)}</td>
              <td className="py-2 text-right tabular-nums text-warn">{S(residual)}</td>
              <td className="py-2 text-right tabular-nums text-muted">{M(running + residual)}</td>
            </tr>
          )}
          <tr className="border-t border-divider font-semibold">
            <td className="py-2">Closing · {closingLabel}</td>
            <td />
            <td className={cn('py-2 text-right tabular-nums', tone(closing - opening))}>{S(closing - opening)}</td>
            <td className="py-2 text-right tabular-nums">{M(closing)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-muted">
        {Math.abs(residual) < 0.5 ? (
          <>
            <CheckCircle2 className="mt-[2px] h-3.5 w-3.5 flex-none text-gain" aria-hidden /> Category contributions sum exactly to the change (shown rounded to the rupee).
          </>
        ) : (
          <>
            <AlertTriangle className="mt-[2px] h-3.5 w-3.5 flex-none text-warn" aria-hidden /> The opening snapshot&apos;s categories don&apos;t add up to its stored net worth; the gap is
            shown as an unresolved difference.
          </>
        )}
        {still.length > 0 && ` No change: ${still.map((r) => CLASS_LABELS[r.cls]).join(', ')}.`}
      </p>
    </div>
  );
}

/** 3. Reconciliation of opening to closing net worth for the selected period */
export function Reconciliation({ period, range }: { period: Period; range: RangeKey }) {
  const { S } = useMoney();
  const { cmp, coverage } = period;
  if (cmp.status !== 'ok') {
    return (
      <Panel className="mt-4">
        <PanelHeader title="Contribution to net-worth change" subtitle={rangeLabel(range)} />
        <p className="text-[14px] text-muted">
          <span className="font-semibold text-ink">Insufficient history.</span>{' '}
          {cmp.reason === 'only-estimates'
            ? 'The saved month-end values for this period were rebuilt later from balances held on the save date, so they cannot reconcile a verified change.'
            : 'No month-end snapshot has been saved for this period yet.'}
        </p>
      </Panel>
    );
  }
  const { rows, residual } = contributions(cmp.opening, cmp.closing, coverage);
  const tracked = rows.filter((r) => Math.abs(r.newlyTracked) >= 0.5);
  const unknown = coverage.filter((c) => c.basis === 'unknown');
  const trackedTotal = tracked.reduce((s, r) => s + r.newlyTracked, 0);
  const unclassified = rows.reduce((s, r) => s + r.unclassified, 0);
  const propertyMoved = rows.find((r) => r.cls === 'property' && Math.abs(r.unclassified) >= 0.5);
  const loansNew = rows.find((r) => r.cls === 'loans' && r.firstAppears);

  return (
    <Panel className="mt-4">
      <PanelHeader title="Contribution to net-worth change" subtitle={`${rangeLabel(range)} · ${fmtDate(cmp.opening.date)} → today (partial month)`} />
      {cmp.later && cmp.requestedStart && <p className="mb-2 text-[13px] text-warn">No reliable value at {fmtDate(cmp.requestedStart)}; the opening is the first recorded month-end after it.</p>}
      <ContributionBridge rows={rows} opening={cmp.opening.netWorth} closing={cmp.closing.netWorth} openingLabel={fmtDate(cmp.opening.date)} closingLabel="today" residual={residual} />

      <h3 className="mt-5 text-[14.5px] font-semibold">What caused it</h3>
      <table className="mt-1 w-full text-[13.5px]">
        <tbody>
          <tr className="border-t border-divider">
            <th scope="row" className="py-2 text-left font-normal">
              Newly tracked assets and liabilities
              <span className="block text-[12px] text-muted">
                Accounts already held on {fmtDate(cmp.opening.date)} (by their own start or purchase dates) but added to the app later
                {tracked.length > 0 && ` — ${tracked.map((r) => `${CLASS_LABELS[r.cls]} ${S(r.newlyTracked, { compact: true })}`).join(' · ')}`}
              </span>
            </th>
            <td className="py-2 text-right tabular-nums">{S(trackedTotal)}</td>
          </tr>
          <tr className="border-t border-divider">
            <th scope="row" className="py-2 text-left font-normal">
              Unclassified balance changes
              <span className="block text-[12px] text-muted">
                Savings, contributions, investment gains or losses, valuation updates and data corrections can&apos;t be told apart: only category balances are recorded.
              </span>
            </th>
            <td className="py-2 text-right tabular-nums">{S(unclassified)}</td>
          </tr>
          {Math.abs(residual) >= 0.5 && (
            <tr className="border-t border-divider">
              <th scope="row" className="py-2 text-left font-normal text-warn">
                Unresolved difference (inconsistent snapshot)
              </th>
              <td className="py-2 text-right tabular-nums text-warn">{S(residual)}</td>
            </tr>
          )}
          <tr className="border-t border-divider font-semibold">
            <th scope="row" className="py-2 text-left">
              Total change
            </th>
            <td className="py-2 text-right tabular-nums">{S(cmp.change)}</td>
          </tr>
        </tbody>
      </table>
      <ul className="mt-3 space-y-1 text-[12.5px] text-muted">
        {unknown.map((c) => (
          <li key={c.cls}>
            {CLASS_LABELS[c.cls]} was empty at the opening and its records carry no start dates — new money or newly tracked, can&apos;t tell.
          </li>
        ))}
        {propertyMoved && <li>Property values are owner estimates: a change there is an estimate update, not investment return.</li>}
        {loansNew && <li>A loan first recorded in this period is not necessarily new borrowing — check its start date.</li>}
        <li>
          Moves between rows are not gains: a transfer between accounts, or loan principal repaid from cash, lowers one row and raises another (or reduces the debt) by the same amount.
        </li>
      </ul>
    </Panel>
  );
}
