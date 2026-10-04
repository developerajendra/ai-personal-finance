'use client';

import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock, HelpCircle, Info, Plug, Unplug } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Dot, Panel, PanelHeader, PanelLink, Segmented, Tag, type Tone } from '@/shared/components/ui';
import { useMoney, pct, fmtDate } from '@/shared/hooks/useMoney';
import type { AssetClass } from '@/shared/hooks/usePortfolioTotals';
import type { CashEvent } from '@/shared/utils/upcoming';
import {
  ATTENTION_RULE,
  type Attention,
  type CashCover,
  type CashFlowMonth,
  type DebtSummary,
  type InvestmentSummary,
  type LiquidityLine,
  type LiquidityTier,
  type SubscriptionSummary,
} from '@/shared/utils/dashboardInsights';
import type { SourceDates, SourceStatus, ValueIssue } from '@/shared/utils/netWorthHistory';

/* --------------------------------------------------------------- helpers */

/** Accessible show/hide for secondary detail */
function Disclosure({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-accent-700 hover:underline">
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        {label}
      </button>
      {open && (
        <div id={id} className="mt-2">
          {children}
        </div>
      )}
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-3 inline-flex items-center gap-1 self-start text-[13px] font-semibold text-accent-700 hover:underline">
      {children} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

function Note({ tone = 'muted', icon, children }: { tone?: 'muted' | 'warn' | 'loss'; icon?: boolean; children: ReactNode }) {
  const Icon = tone === 'muted' ? Info : AlertTriangle;
  return (
    <p className={cn('mt-1.5 flex gap-1.5 text-[12.5px] leading-snug', { muted: 'text-muted', warn: 'text-warn', loss: 'text-loss' }[tone])}>
      {icon !== false && <Icon className="mt-[2px] h-3.5 w-3.5 flex-none" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

const share = (v: number, of: number) => (of > 0 ? (v / of) * 100 : 0);

/* ------------------------------------------------------- Asset allocation */

export function AllocationPanel({
  classes,
  assets,
  largest,
  marketValue,
}: {
  classes: AssetClass[];
  assets: number;
  largest: { label: string; value: number; href: string } | null;
  /** Stocks & funds class value */
  marketValue: number;
}) {
  const { M, C } = useMoney();
  const sorted = [...classes].filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const second = sorted[1];
  const financial = assets - (classes.find((c) => c.key === 'property')?.value ?? 0) - (classes.find((c) => c.key === 'recv')?.value ?? 0);

  return (
    <Panel className="flex min-w-0 flex-col">
      <PanelHeader title="Asset allocation" subtitle={`Total assets ${M(assets)} · shares of total assets, before liabilities`} action={<PanelLink href="/portfolio">View portfolio</PanelLink>} />
      {sorted.length === 0 ? (
        <p className="text-[14px] text-muted">No published holdings yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-5">
            <div className="h-[132px] w-[132px] flex-none" role="img" aria-label={`Asset allocation: ${sorted.map((c) => `${c.label} ${pct(c.share)}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sorted} dataKey="value" nameKey="label" innerRadius={40} outerRadius={64} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
                    {sorted.map((c) => (
                      <Cell key={c.key} fill={c.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-[220px] flex-1 space-y-1.5">
              {sorted.map((c) => (
                <li key={c.key}>
                  <Link href={c.href} className="flex items-center gap-2.5 rounded py-0.5 text-[14px] hover:text-accent-700">
                    <Dot color={c.color} size={9} />
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    <span className="tabular-nums">{C(c.value)}</span>
                    <span className="w-12 text-right tabular-nums text-muted">{pct(c.share)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {top && (
            <p className="mt-3 text-[13px]">
              {top.label} is the largest category at {pct(top.share)} of total assets
              {second ? `; with ${second.label} the two make up ${pct(top.share + second.share)}.` : '.'}
            </p>
          )}
          <Disclosure label="Exposure details" className="mt-2">
            <dl className="space-y-2 text-[13px]">
              <div>
                <dt className="font-medium">Equity exposure</dt>
                <dd className="text-muted">
                  Stocks & funds {C(marketValue)} = {pct(share(marketValue, assets))} of total assets, or {pct(share(marketValue, financial))} of financial assets (total assets excluding
                  property and receivables, {C(financial)}).
                </dd>
              </div>
              {largest && (
                <div>
                  <dt className="font-medium">Largest single holding</dt>
                  <dd className="text-muted">
                    <Link href={largest.href} className="text-ink hover:text-accent-700">
                      {largest.label}
                    </Link>{' '}
                    {C(largest.value)} = {pct(share(largest.value, assets))} of total assets ({pct(share(largest.value, financial))} of financial assets). Individual properties are not
                    compared here.
                  </dd>
                </div>
              )}
              <p className="text-[12px] text-muted">Loans are liabilities and are not part of this chart — see Debt.</p>
            </dl>
          </Disclosure>
        </>
      )}
    </Panel>
  );
}

/* --------------------------------------------------------- Available cash */

export function CashCard({ cover, accounts }: { cover: CashCover; accounts: number }) {
  const { M } = useMoney();
  const staleValue = cover.staleAccounts.reduce((s, b) => s + (b.balance || 0), 0);
  return (
    <Panel className="flex min-w-0 flex-col">
      <h2 className="eyebrow">Available cash</h2>
      <div className="mt-2 text-[24px] font-bold tabular-nums tracking-[-0.02em]">{M(cover.balance)}</div>
      <p className="mt-1 text-[12.5px] text-muted">
        Recorded balances in {accounts} account{accounts === 1 ? '' : 's'}
        {cover.oldest && (cover.newest && cover.newest.getTime() !== cover.oldest.getTime() ? ` · dated ${fmtDate(cover.oldest)} – ${fmtDate(cover.newest)}` : ` · dated ${fmtDate(cover.oldest)}`)}
      </p>
      {cover.staleAccounts.length > 0 && (
        <Note tone="warn">
          {cover.staleAccounts.length} account{cover.staleAccounts.length === 1 ? '' : 's'} ({M(staleValue)}) not updated in 60+ days — not today&apos;s balance.
        </Note>
      )}
      {cover.undatedAccounts.length > 0 && <Note tone="warn">{cover.undatedAccounts.length} account(s) have no balance date.</Note>}

      <div className="mt-3 border-t border-divider pt-2.5 text-[13px]">
        {cover.status === 'unavailable' ? (
          <>
            <div className="flex items-center gap-1.5 font-medium">
              <HelpCircle className="h-3.5 w-3.5 text-muted" aria-hidden /> Months of cover: unavailable
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {cover.reasons[0]}{' '}
              <Link href="/budget" className="text-accent-700 hover:underline">
                Plan expenses in Budget
              </Link>
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold tabular-nums">≈ {cover.months != null ? cover.months.toFixed(1) : '—'} months</span>
              <span className="text-muted">of planned spending</span>
              {cover.status === 'provisional' && <Tag tone="warn">Provisional</Tag>}
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {M(cover.monthly)}/month = Budget plan {M(cover.planned)} (your estimate, monthly equivalent) + loan EMIs {M(cover.emi)}. Not actual spending.
            </p>
            {cover.reasons.map((r) => (
              <Note key={r} tone="warn">
                {r}
              </Note>
            ))}
          </>
        )}
      </div>
      <CardLink href="/portfolio/bank-balances">Cash &amp; bank</CardLink>
    </Panel>
  );
}

/* ------------------------------------------------------------------- Debt */

export function DebtCard({ debt, assets }: { debt: DebtSummary; assets: number }) {
  const { M } = useMoney();
  const n = debt.checks.length;
  const problem = debt.checks.filter((c) => c.check.status !== 'known');
  return (
    <Panel className="flex min-w-0 flex-col">
      <h2 className="eyebrow">Debt</h2>
      <div className="mt-2 text-[24px] font-bold tabular-nums tracking-[-0.02em]">{M(debt.outstanding)}</div>
      <p className="mt-1 text-[12.5px] text-muted">
        {n === 0 ? 'No active loans' : `Outstanding on ${n} active loan${n === 1 ? '' : 's'} · ${pct(share(debt.outstanding, assets))} of total assets`}
      </p>
      {n > 0 && (
        <div className="mt-3 space-y-1 border-t border-divider pt-2.5 text-[13px]">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted">Known EMIs</span>
            <span className="font-semibold tabular-nums">{M(debt.knownEmi)}/month</span>
            {debt.incomplete && <Tag tone="warn">Incomplete</Tag>}
          </div>
          {problem.map(({ loan, check }) => (
            <Note key={loan.id} tone="warn">
              {loan.name}:{' '}
              {check.status === 'unknown'
                ? 'EMI not recorded — unknown, not zero.'
                : check.status === 'implausible'
                  ? `recorded EMI ${M(loan.emiAmount)} exceeds what a monthly payment can be — not counted.`
                  : `EMI ${M(loan.emiAmount)} differs from the loan terms (≈ ${M(check.expected)}) — unverified.`}
            </Note>
          ))}
          {debt.statementConflicts.map((c) => (
            <Note key={c.loan.id} tone="warn">
              {c.loan.name}: record says {M(c.record)}, latest statement ({fmtDate(c.date)}) says {M(c.statement)}.
            </Note>
          ))}
          {debt.next && (
            <div className="text-[12.5px] text-muted">
              Next payment: {debt.next.loan.name}, {fmtDate(debt.next.date)} · {debt.next.amount != null ? M(debt.next.amount) : 'amount unknown'}
            </div>
          )}
        </div>
      )}
      <CardLink href="/portfolio/loans">Loans</CardLink>
    </Panel>
  );
}

/* ----------------------------------------------- Investment performance */

export function InvestmentCard({ inv, period }: { inv: InvestmentSummary; period: string }) {
  const { M, S, C } = useMoney();
  const tone = inv.unrealised == null ? '' : inv.unrealised > 0 ? 'text-gain' : inv.unrealised < 0 ? 'text-loss' : '';
  return (
    <Panel className="flex min-w-0 flex-col">
      <h2 className="eyebrow">Investment performance</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        Scope: {inv.holdings} broker-held stock{inv.holdings === 1 ? '' : 's'} &amp; funds{inv.priced === false ? ' · last synced prices' : ''}
      </p>
      {inv.holdings === 0 ? (
        <>
          <div className="mt-2 text-[24px] font-bold tabular-nums">{M(inv.manualValue)}</div>
          <Note>Recorded value only — no broker holdings with prices and cost, so returns can&apos;t be calculated.</Note>
        </>
      ) : (
        <>
          <div className="mt-2 text-[24px] font-bold tabular-nums tracking-[-0.02em]">{M(inv.marketValue)}</div>
          <p className="text-[12.5px] text-muted">Market value{inv.cost != null ? ` · cost basis ${M(inv.cost)}` : ''}</p>
          {inv.unrealised != null ? (
            <div className="mt-2 text-[13px]">
              <span className={cn('font-semibold tabular-nums', tone)}>
                {inv.unrealised > 0 ? '▲ ' : inv.unrealised < 0 ? '▼ ' : ''}
                {S(inv.unrealised)}
                {inv.unrealisedPct != null && ` (${inv.unrealisedPct >= 0 ? '+' : '−'}${Math.abs(inv.unrealisedPct).toFixed(1)}%)`}
              </span>{' '}
              <span className="text-muted">unrealised gain since purchase — lifetime, not a {period} return</span>
            </div>
          ) : (
            <Note tone="warn">Some holdings have no average cost, so gains can&apos;t be calculated.</Note>
          )}
          <Note>
            {period} return unavailable: purchases, sales and withdrawals for these holdings aren&apos;t recorded, so contributions can&apos;t be separated from gains.
          </Note>
        </>
      )}
      {inv.manualCount > 0 && inv.holdings > 0 && (
        <Note>
          Not in scope: {inv.manualCount} manually recorded stock/fund record{inv.manualCount === 1 ? '' : 's'} ({C(inv.manualValue)}) — value only, no cost or price tracking.
        </Note>
      )}
      <CardLink href="/performance#investments">Investment analysis</CardLink>
    </Panel>
  );
}

/* -------------------------------------------------------- Needs attention */

const TIER = {
  1: { label: 'Urgent', icon: AlertOctagon, cls: 'text-loss' },
  2: { label: 'Fix record', icon: AlertTriangle, cls: 'text-warn' },
  3: { label: 'Update', icon: Clock, cls: 'text-muted' },
} as const;

export function AttentionPanel({ items }: { items: Attention[] }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, 3);
  return (
    <Panel>
      <PanelHeader title="Needs attention" subtitle={`${items.length} item${items.length === 1 ? '' : 's'} · ${ATTENTION_RULE}`} />
      <ul>
        {shown.map((it) => {
          const t = TIER[it.tier];
          return (
            <li key={it.key} className="flex gap-3 border-b border-divider py-3 last:border-0">
              <t.icon className={cn('mt-0.5 h-4 w-4 flex-none', t.cls)} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className={cn('text-[11.5px] font-semibold uppercase tracking-wide', t.cls)}>{t.label}</span>
                  <span className="text-[14.5px] font-semibold">{it.title}</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{it.reason}</p>
                <Link href={it.href} className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-accent-700 hover:underline">
                  {it.action} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > 3 && (
        <button type="button" aria-expanded={all} onClick={() => setAll(!all)} className="mt-2 text-[13px] font-semibold text-accent-700 hover:underline">
          {all ? 'Show fewer' : `Show ${items.length - 3} more`}
        </button>
      )}
    </Panel>
  );
}

/* --------------------------------------------------- Upcoming commitments */

const KIND_LABEL: Record<CashEvent['kind'], string> = { emi: 'EMI', subscription: 'Subscription', maturity: 'Maturity', receivable: 'Receivable', salary: 'Salary' };

export function CommitmentsPanel({ events, overdueCount, days, onDays }: { events: CashEvent[]; overdueCount: number; days: 30 | 90; onDays: (d: 30 | 90) => void }) {
  const { M } = useMoney();
  const payments = events.filter((e) => e.amount < 0 || e.amountStatus === 'unknown');
  const receipts = events.filter((e) => e.amount > 0 && e.amountStatus !== 'unknown');
  const counted = payments.filter((e) => !e.amountStatus);
  const notCounted = payments.filter((e) => e.amountStatus);
  const paymentTotal = counted.reduce((s, e) => s - e.amount, 0);
  const firm = receipts.filter((e) => e.kind === 'maturity' && !e.expected);
  const uncertain = receipts.filter((e) => !(e.kind === 'maturity' && !e.expected));

  const row = (e: CashEvent) => (
    <li key={e.id} className="flex items-center gap-3 border-b border-divider py-2 last:border-0">
      <span className="w-[52px] flex-none text-[12.5px] tabular-nums text-muted">{fmtDate(e.date).replace(/ \d{4}$/, '')}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px]">{e.title}</span>
        <span className="block truncate text-[12px] text-muted">
          {KIND_LABEL[e.kind]}
          {e.expected ? ' · projected' : ''}
          {e.kind === 'receivable' ? ' · depends on the borrower' : ''}
        </span>
      </span>
      <span className="text-right text-[14px] tabular-nums">
        {e.amountStatus === 'unknown' ? (
          <span className="text-warn">Amount unknown</span>
        ) : e.amountStatus === 'unverified' ? (
          <span className="text-warn">{M(Math.abs(e.amount))}?</span>
        ) : (
          <span className={e.amount > 0 ? 'text-gain' : ''}>
            {e.amount > 0 ? '+' : '−'}
            {M(Math.abs(e.amount))}
          </span>
        )}
      </span>
    </li>
  );

  return (
    <Panel className="flex min-w-0 flex-col">
      <PanelHeader
        title="Upcoming commitments"
        subtitle={`Next ${days} days`}
        action={<Segmented<'30' | '90'> options={[{ value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} value={String(days) as '30' | '90'} onChange={(v) => onDays(Number(v) as 30 | 90)} ariaLabel="Window" />}
      />
      {overdueCount > 0 && (
        <p className="mb-2 flex items-center gap-1.5 text-[13px] text-loss">
          <AlertOctagon className="h-3.5 w-3.5" aria-hidden /> {overdueCount} overdue item{overdueCount === 1 ? '' : 's'} — listed in Needs attention.
        </p>
      )}
      <h3 className="text-[13px] font-semibold">
        Payments · {M(paymentTotal)}
        {notCounted.length > 0 && <span className="font-normal text-warn"> + {notCounted.length} not counted (amount unknown or unverified)</span>}
      </h3>
      {payments.length === 0 ? <p className="py-2 text-[13px] text-muted">No EMIs or renewals due in the next {days} days.</p> : <ul>{payments.slice(0, days === 30 ? 6 : 10).map(row)}</ul>}
      {payments.length > (days === 30 ? 6 : 10) && <p className="text-[12px] text-muted">+ {payments.length - (days === 30 ? 6 : 10)} more in the calendar</p>}

      {receipts.length > 0 && (
        <>
          <h3 className="mt-3 text-[13px] font-semibold">
            Expected receipts · {M(firm.reduce((s, e) => s + e.amount, 0))} scheduled
            {uncertain.length > 0 && <span className="font-normal text-muted"> + {M(uncertain.reduce((s, e) => s + e.amount, 0))} uncertain</span>}
          </h3>
          <ul>{receipts.slice(0, 5).map(row)}</ul>
        </>
      )}
      <p className="mt-2 text-[12px] text-muted">
        Payment total counts recorded amounts only. Yearly subscriptions appear at their full renewal amount. Receipts are not treated as available cash; projected salary and
        receivables may not arrive on time.
      </p>
      <CardLink href="/upcoming">Calendar</CardLink>
    </Panel>
  );
}

/* --------------------------------------------------------------- Liquidity */

export function LiquidityPanel({ tiers, receivables, assets }: { tiers: LiquidityTier[]; receivables: LiquidityLine; assets: number }) {
  const { M, C } = useMoney();
  const line = (l: LiquidityLine) => (
    <li key={l.key} className="flex items-start gap-2 py-1.5 text-[13px]">
      <span className="min-w-0 flex-1">
        <span className="block">{l.label}</span>
        <span className="block text-[12px] text-muted">
          {l.note}
          {l.asOf ? ` · as of ${fmtDate(l.asOf)}` : ''}
        </span>
      </span>
      <span className="tabular-nums">{C(l.value)}</span>
    </li>
  );
  return (
    <Panel className="flex min-w-0 flex-col">
      <PanelHeader title="Liquidity" subtitle="How quickly assets can become spendable cash" />
      <ul className="space-y-3">
        {tiers.map((t) => (
          <li key={t.key} className="border-b border-divider pb-3 last:border-0">
            <div className="flex items-baseline gap-2">
              <span className="flex-1 text-[14.5px] font-semibold">{t.label}</span>
              <span className="text-[14.5px] font-semibold tabular-nums">{M(t.total)}</span>
              <span className="w-12 text-right text-[12.5px] tabular-nums text-muted">{pct(share(t.total, assets))}</span>
            </div>
            <p className="text-[12.5px] text-muted">{t.timing}</p>
            {t.lines.length > 0 && (
              <Disclosure label="Details" className="mt-1">
                <ul>{t.lines.map(line)}</ul>
              </Disclosure>
            )}
          </li>
        ))}
      </ul>
      {receivables.value > 0 && (
        <p className="mt-2 text-[12.5px] text-muted">
          Not included: receivables {C(receivables.value)} — {receivables.note.toLowerCase()}.
        </p>
      )}
      <p className="mt-1 text-[12px] text-muted">Percentages are of total assets.</p>
    </Panel>
  );
}

/* ----------------------------------------------------------- Subscriptions */

export function SubscriptionsSummary({ summary, isLoading }: { summary: SubscriptionSummary; isLoading: boolean }) {
  const { M } = useMoney();
  const dueTotal = summary.dueSoon.reduce((s, d) => s + d.amount, 0);
  return (
    <Panel className="flex min-w-0 flex-col">
      <PanelHeader title="Subscriptions" action={<PanelLink href="/subscriptions">View subscriptions</PanelLink>} />
      {isLoading ? (
        <p className="text-[13px] text-muted">Loading…</p>
      ) : summary.active === 0 ? (
        <p className="text-[13px] text-muted">No active subscriptions.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-muted">Monthly equivalent</dt>
            <dd className="text-[18px] font-bold tabular-nums">{M(summary.monthlyEquivalent)}</dd>
            <dd className="text-[12px] text-muted">yearly plans ÷ 12 — a run rate, not a bill</dd>
          </div>
          <div>
            <dt className="text-muted">Active</dt>
            <dd className="text-[18px] font-bold tabular-nums">{summary.active}</dd>
          </div>
          <div>
            <dt className="text-muted">Renewing in 30 days</dt>
            <dd className="text-[18px] font-bold tabular-nums">{summary.dueSoon.length}</dd>
            <dd className="text-[12px] text-muted">{summary.dueSoon.length ? `${M(dueTotal)} billed, full amounts` : 'nothing billed'}</dd>
          </div>
        </dl>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------- Data freshness */

const STATUS: Record<SourceStatus, { label: string; tone: Tone; icon: typeof Info }> = {
  current: { label: 'Current', tone: 'gain', icon: CheckCircle2 },
  stale: { label: 'Stale', tone: 'loss', icon: Clock },
  undated: { label: 'Date unknown', tone: 'warn', icon: HelpCircle },
  estimate: { label: 'Estimate', tone: 'neutral', icon: Info },
  missing: { label: 'Missing data', tone: 'loss', icon: AlertTriangle },
  connected: { label: 'Connected', tone: 'gain', icon: Plug },
  disconnected: { label: 'Not connected', tone: 'warn', icon: Unplug },
  checking: { label: 'Checking', tone: 'neutral', icon: Clock },
};

export function FreshnessSummary({ sources, issues }: { sources: SourceDates[]; issues: ValueIssue[] }) {
  const { M } = useMoney();
  return (
    <Panel className="flex min-w-0 flex-col">
      <PanelHeader title="Data freshness" action={<PanelLink href="/data/upload">Imports &amp; data</PanelLink>} />
      <ul className="space-y-1.5">
        {sources.map((s) => {
          const st = STATUS[s.status];
          return (
            <li key={s.source} className="flex items-center gap-2 text-[13.5px]">
              <Link href={s.href} className="min-w-0 flex-1 truncate hover:text-accent-700">
                {s.source}
              </Link>
              <Tag tone={st.tone} className="font-semibold">
                <st.icon className="mr-1 h-3 w-3" aria-hidden />
                {st.label}
              </Tag>
            </li>
          );
        })}
      </ul>
      <Disclosure label="Source details" className="mt-2">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-medium">Source</th>
              <th className="py-1 font-medium">Balance / valuation date</th>
              <th className="py-1 font-medium">Imported / refreshed</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.source} className="border-t border-divider align-top">
                <td className="py-1.5 pr-2">{s.source}</td>
                <td className="py-1.5 pr-2">{s.balanceDate ? fmtDate(s.balanceDate) : 'not recorded'}</td>
                <td className="py-1.5">
                  {s.refreshed ? fmtDate(s.refreshed) : '—'}
                  {s.note && <span className="block text-muted">{s.note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {issues.filter((i) => i.kind === 'missing').map((i) => (
          <Note key={i.source + i.detail} tone="loss">
            {i.source}: {i.detail}
          </Note>
        ))}
        <p className="mt-2 text-[12px] text-muted">
          A recent import does not make a balance current — status follows the balance&apos;s own date. Material issues ({issues.filter((i) => i.material).length}) also appear in Needs
          attention{issues.some((i) => i.material && i.amount) ? `, covering ${M(issues.filter((i) => i.material).reduce((s, i) => s + i.amount, 0))}` : ''}.
        </p>
      </Disclosure>
    </Panel>
  );
}

/* --------------------------------------------------------------- Cash flow */

export function CashFlowCard({ flow, asOf }: { flow: CashFlowMonth; asOf: Date }) {
  const { M, S } = useMoney();
  return (
    <Panel className="flex min-w-0 flex-col">
      <PanelHeader title="Cash flow this month" subtitle={`Partial month · 1 – ${fmtDate(asOf)}`} />
      <dl className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
        <div>
          <dt className="text-muted">Income</dt>
          <dd className="font-semibold tabular-nums">{M(flow.income)}</dd>
        </div>
        <div>
          <dt className="text-muted">Spending</dt>
          <dd className="font-semibold tabular-nums">{M(flow.spending)}</dd>
        </div>
        <div>
          <dt className="text-muted">Loan payments</dt>
          <dd className="font-semibold tabular-nums">{M(flow.loanPayments)}</dd>
        </div>
        <div>
          <dt className="text-muted">{flow.surplus >= 0 ? 'Surplus' : 'Deficit'}</dt>
          <dd className={cn('font-semibold tabular-nums', flow.surplus >= 0 ? 'text-gain' : 'text-loss')}>{S(flow.surplus)}</dd>
        </div>
      </dl>
      <Note>
        Excludes transfers between accounts, loan proceeds and investment purchases. Spending excludes loan payments, shown separately (principal and interest aren&apos;t split in
        the data).
      </Note>
      <CardLink href="/performance#cash-flow">Cash-flow history</CardLink>
    </Panel>
  );
}
