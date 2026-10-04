'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Drawer, Panel, Segmented, Skeleton } from '@/shared/components/ui';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { useSnapshots } from '@/shared/hooks/useSnapshots';
import type { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';
import { useNetWorthPeriod } from '@/shared/hooks/useNetWorthPeriod';
import { NetWorthTrendChart } from '@/shared/components/NetWorthTrendChart';
import { cn } from '@/shared/utils/cn';
import {
  CLASS_LABELS,
  DEFAULT_RANGE,
  MATERIAL_SHARE,
  OPENING_TOLERANCE_DAYS,
  RANGES,
  RECORDED_LAG_DAYS,
  STALE_DAYS,
  assessCurrent,
  chartPoints,
  rangeLabel,
  type IssueKind,
  type LoanStatement,
  type RangeKey,
} from '@/shared/utils/netWorthHistory';

type Totals = ReturnType<typeof usePortfolioTotals>;

const ISSUE_TEXT: Record<IssueKind, string> = { stale: 'out of date', undated: 'balance date unknown', estimated: 'estimate', missing: 'missing' };


/**
 * Net worth card: today's verified total, change over the chosen period against a recorded
 * month-end value, and the trend. History rules live in shared/utils/netWorthHistory.
 */
export function NetWorthPanel({ t, marketLive, loanStatements }: { t: Totals; marketLive: boolean | undefined; loanStatements?: Record<string, LoanStatement> }) {
  const { M, C, S } = useMoney();
  const snapshots = useSnapshots();
  const snapsLoading = snapshots.isLoading;
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const [infoOpen, setInfoOpen] = useState(false);
  const { now, live, history, cmp, opening, coverage, isLoading: loading } = useNetWorthPeriod(t, snapshots, range);
  const points = useMemo(() => chartPoints(history.observations, live, range, now, opening), [history, live, range, now, opening]);

  const quality = useMemo(
    () =>
      assessCurrent({
        cashAccounts: t.cashAccounts,
        loans: t.activeLoans,
        loanStatements,
        properties: t.properties,
        ppfAccounts: t.ppfAccounts,
        marketValue: t.totalStocks + t.totalMutualFunds,
        marketLive,
        assets: t.assets,
        liabilities: t.liabilities,
        now,
      }),
    [t.cashAccounts, t.activeLoans, loanStatements, t.properties, t.ppfAccounts, t.totalStocks, t.totalMutualFunds, marketLive, t.assets, t.liabilities, now],
  );
  const material = quality.issues.filter((i) => i.material);
  const minor = quality.issues.filter((i) => !i.material);
  const missing = material.some((i) => i.kind === 'missing');
  const oldestMaterial = material.map((i) => i.asOf).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];

  const heldBefore = coverage.filter((c) => c.basis === 'held-before');
  const unknown = coverage.filter((c) => c.basis === 'unknown');
  const addedTotal = heldBefore.reduce((s, c) => s + c.amount, 0);
  /** Opening and today track the same accounts, as far as record dates can tell */
  const comparable = coverage.length === 0;

  return (
    <Panel className="flex min-w-0 flex-col">
      {/* Title + method */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="eyebrow">Net worth</h2>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-tile hover:text-ink"
          aria-label="How net worth is calculated, data sources and limitations">
          <Info className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Current value */}
      {t.isLoading ? (
        <Skeleton className="mt-3 h-12 w-72 max-w-full" />
      ) : (
        <div className="mt-2 break-words text-[clamp(30px,4.2vw,48px)] font-bold leading-none tracking-[-0.035em] text-ink tabular-nums">{M(t.netWorth)}</div>
      )}
      {!t.isLoading && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <span className="text-muted">
            As of {fmtDate(now)}
            {oldestMaterial && ` · oldest material balance ${fmtDate(oldestMaterial)}`}
          </span>
          <button type="button" onClick={() => setInfoOpen(true)} className={cn('inline-flex items-center gap-1 rounded text-left', material.length ? 'text-warn' : 'text-gain')}>
            {material.length ? <AlertTriangle className="h-3.5 w-3.5 flex-none" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5 flex-none" aria-hidden />}
            <span className="underline decoration-dotted underline-offset-2">
              {missing
                ? 'Incomplete — some balances missing'
                : material.length
                  ? `Includes ${[...new Set(material.map((i) => (i.kind === 'estimated' ? 'estimates' : i.kind === 'undated' ? 'undated balances' : 'out-of-date balances')))].join(' and ')}`
                  : minor.length
                    ? `Up to date · ${minor.length} minor note${minor.length === 1 ? '' : 's'}`
                    : 'All balances up to date'}
            </span>
          </button>
        </div>
      )}

      {/* Period change */}
      <div className="mt-4 min-h-[44px]">
        {loading ? (
          <Skeleton className="h-9 w-64 max-w-full" />
        ) : cmp.status === 'ok' ? (
          <div>
            <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px] font-semibold tabular-nums', comparable ? toneOf(cmp.change) : 'text-ink')}>
              {comparable ? <ChangeIcon value={cmp.change} /> : <AlertTriangle className="h-4 w-4 text-warn" aria-hidden />}
              <span>
                <span className="sr-only">{cmp.change > 0 ? 'Up' : cmp.change < 0 ? 'Down' : 'No change'} </span>
                {S(cmp.change)}
              </span>
              {comparable && cmp.pct != null && <span className="text-[15px]">({(cmp.pct > 0 ? '+' : cmp.pct < 0 ? '−' : '') + Math.abs(cmp.pct).toFixed(1)}%)</span>}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {rangeLabel(range)}: {fmtDate(cmp.opening.date)} → today
              {cmp.later && cmp.requestedStart && ` · no reliable value at ${fmtDate(cmp.requestedStart)}, so compared from the first one after`}
              {comparable && cmp.pct == null && ` · no % shown: opening net worth was ${cmp.opening.netWorth < 0 ? 'negative' : 'zero'}`}
            </p>
            {!comparable && <p className="mt-0.5 text-[13px] text-warn">Not like-for-like: accounts were added to the app during this period (see below), so no % is shown.</p>}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 text-[17px] font-semibold text-ink">
              <Minus className="h-4 w-4 text-muted" aria-hidden />
              Insufficient history
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {cmp.reason === 'only-estimates'
                ? `No month-end value for this period was recorded at the time — the saved ones were rebuilt later, so they can't verify a ${rangeLabel(range)} change.`
                : `No month-end value saved for ${cmp.requestedStart ? `around ${fmtDate(cmp.requestedStart)}` : 'this period'} yet.`}
            </p>
          </div>
        )}
      </div>

      {/* Range */}
      <div className="mt-3">
        <Segmented<RangeKey> options={RANGES} value={range} onChange={setRange} ariaLabel="Period" />
      </div>

      {/* Trend */}
      <NetWorthTrendChart points={points} loading={snapsLoading} className="mt-3" />

      {/* What changed */}
      {cmp.status === 'ok' && (
        <div className="mt-4 border-t border-divider pt-3 text-[13px]">
          <h3 className="text-[13px] font-semibold text-ink">What changed</h3>
          {heldBefore.length > 0 && (
            <p className="mt-1">
              <span className="font-medium tabular-nums">{S(addedTotal)}</span> is accounts you already had on {fmtDate(cmp.opening.date)} but added to the app later — not growth{' '}
              <span className="text-muted">({heldBefore.map((c) => `${CLASS_LABELS[c.cls]} ${S(c.amount, { compact: true })}`).join(' · ')})</span>.
            </p>
          )}
          {unknown.map((c) => (
            <p key={c.cls} className="mt-1 text-muted">
              {CLASS_LABELS[c.cls]} was empty on {fmtDate(cmp.opening.date)}; its {C(Math.abs(c.amount))} may be new money or a newly tracked account.
            </p>
          ))}
          <p className="mt-1 text-muted">
            {heldBefore.length > 0
              ? `The other ≈ ${S(cmp.change - addedTotal)} can't be broken down, and may include cash or market holdings added since — those carry no start dates.`
              : 'Change breakdown unavailable — snapshots store balances, not the savings, market moves and revaluations behind them.'}
          </p>
        </div>
      )}
      <Link
        href={`/performance?range=${range}`}
        className="mt-3 inline-flex items-center gap-1 self-start text-[13px] font-semibold text-accent-700 hover:underline">
        Opening-to-closing reconciliation · {rangeLabel(range)} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>

      <Drawer open={infoOpen} onClose={() => setInfoOpen(false)} title="How net worth is calculated" subtitle={`As of ${fmtDate(now)}`} width={520}>
        <div className="space-y-5 text-[14px] leading-relaxed">
          <section>
            <h3 className="font-semibold text-ink">Definition</h3>
            <p className="mt-1 text-muted">
              Total assets minus outstanding loan balances. Loans count at what is still owed — never the original principal or the EMI. The same figures appear in Portfolio → Balance
              sheet; how quickly assets could become cash is in the dashboard&apos;s Liquidity section.
            </p>
            <table className="mt-3 w-full text-[13.5px]">
              <caption className="sr-only">Assets minus liabilities</caption>
              <tbody>
                {[...t.classes]
                  .filter((c) => c.value !== 0)
                  .sort((a, b) => b.value - a.value)
                  .map((c) => (
                    <tr key={c.key} className="border-b border-divider">
                      <th scope="row" className="py-1.5 text-left font-normal">
                        {c.label}
                      </th>
                      <td className="py-1.5 text-right tabular-nums">{M(c.value)}</td>
                    </tr>
                  ))}
                <tr className="border-b border-divider font-semibold">
                  <th scope="row" className="py-1.5 text-left">
                    Total assets
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{M(t.assets)}</td>
                </tr>
                <tr className="border-b border-divider">
                  <th scope="row" className="py-1.5 text-left font-normal">
                    Minus loans outstanding
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{M(-t.liabilities)}</td>
                </tr>
                <tr className="font-semibold">
                  <th scope="row" className="py-1.5 text-left">
                    Net worth
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{M(t.netWorth)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="font-semibold text-ink">Data behind today&apos;s total</h3>
            {quality.issues.length === 0 ? (
              <p className="mt-1 text-muted">Every balance is recent and measured.</p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {quality.issues.map((i, n) => (
                  <li key={n} className="flex gap-2">
                    {i.material ? <AlertTriangle className="mt-1 h-3.5 w-3.5 flex-none text-warn" aria-hidden /> : <Info className="mt-1 h-3.5 w-3.5 flex-none text-muted" aria-hidden />}
                    <span>
                      <span className="font-medium">{i.source}</span> · {ISSUE_TEXT[i.kind]}
                      {i.amount ? ` · ${M(i.amount)}` : ''} — {i.detail}
                      {i.asOf ? ` (since ${fmtDate(i.asOf)})` : ''}
                      {!i.material && <span className="text-muted"> · minor</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {quality.sources.length > 0 && (
              <table className="mt-3 w-full text-[13px]">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 font-medium">Source</th>
                    <th className="py-1 font-medium">Balance date</th>
                    <th className="py-1 font-medium">Imported / refreshed</th>
                  </tr>
                </thead>
                <tbody>
                  {quality.sources.map((s) => (
                    <tr key={s.source} className="border-t border-divider align-top">
                      <td className="py-1.5 pr-2">{s.source}</td>
                      <td className="py-1.5 pr-2">{s.balanceDate ? fmtDate(s.balanceDate) : '—'}</td>
                      <td className="py-1.5">
                        {s.refreshed ? fmtDate(s.refreshed) : '—'}
                        {s.note && <span className="block text-[12px] text-muted">{s.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-[12.5px] text-muted">
              Material = at least {MATERIAL_SHARE * 100}% of assets plus loans. Bank balances are out of date after {STALE_DAYS.bank} days, loans after {STALE_DAYS.loans}, EPF after{' '}
              {STALE_DAYS.epf}. Property values are always owner estimates.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-ink">Period change</h3>
            <p className="mt-1 text-muted">
              3M and 6M roll back from today; YTD starts 1 January; All time starts at the first reliable snapshot. The comparison uses the latest recorded month-end value on or up to{' '}
              {OPENING_TOLERANCE_DAYS} days before the start, otherwise the first one after it — the date shown is always the one used. Today&apos;s value is the closing point for every
              range. A percentage is shown only when the opening net worth was positive.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-ink">History</h3>
            <p className="mt-1 text-muted">
              A month-end snapshot counts as recorded only if it was saved within {RECORDED_LAG_DAYS} days after the month ended. Snapshots saved later were rebuilt from the bank, market,
              EPF and property balances held on the day they were saved, and loan balances from a straight-line estimate where no statement exists — so they are shown as estimates (hollow
              points, dashed line) and never used for the period change. Missing months stay as gaps, not zero. The line breaks where a whole asset or loan type first appears, since that
              is newly tracked data rather than growth.
            </p>
            <ul className="mt-2 space-y-0.5 text-[13px] text-muted">
              <li>
                {history.observations.length} month-end value{history.observations.length === 1 ? '' : 's'} saved · {history.observations.filter((o) => o.quality === 'recorded').length} recorded at the
                time
              </li>
              {history.duplicates > 0 && <li>{history.duplicates} duplicate snapshot{history.duplicates === 1 ? '' : 's'} for the same month ignored (latest save kept)</li>}
              {history.unfinished > 0 && <li>{history.unfinished} snapshot{history.unfinished === 1 ? '' : 's'} for a month that hasn&apos;t ended ignored</li>}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-ink">What changed</h3>
            <p className="mt-1 text-muted">
              Accounts that existed at the opening date but were added to the app afterwards (by their own start or purchase date) are separated out — they are not growth. Transfers
              between tracked accounts and loan principal repayments move money between rows and leave net worth unchanged. A finer split into savings, market moves and revaluations
              needs flow data the snapshots don&apos;t keep, so it is not shown.
            </p>
          </section>
        </div>
      </Drawer>
    </Panel>
  );
}

const toneOf = (v: number) => (Math.abs(v) < 0.5 ? 'text-ink' : v > 0 ? 'text-gain' : 'text-loss');

function ChangeIcon({ value }: { value: number }) {
  if (Math.abs(value) < 0.5) return <Minus className="h-4 w-4" aria-hidden />;
  return value > 0 ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />;
}
