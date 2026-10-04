'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/shared/utils/cn';
import { Loan } from '@/shared/types';
import { EmptyState, Metric, Panel, PanelHeader } from '@/shared/components/ui';
import { useMoney, fmtDate, monthShort } from '@/shared/hooks/useMoney';
import { fetchLoanSnapshots } from './LoanAnalyticsModule';

const titleCase = (v: string) => v.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

/**
 * Loan hero from the design: outstanding balance, principal-repaid progress,
 * EMI / rate / tenure / interest metrics, and the outstanding balance by month.
 * Shows the loan picked in the page filter; with a year, figures come from that year's snapshots.
 * Uses the same ['loan-analytics-snapshots'] query as LoanAnalyticsModule.
 */
export function LoanHero({ loan, year }: { loan: Loan | undefined; year: number | null }) {
  const { M, C } = useMoney();
  const { data } = useQuery({ queryKey: ['loan-analytics-snapshots'], queryFn: fetchLoanSnapshots });

  const snaps = useMemo(
    () => (data?.snapshots ?? []).map((x) => x.snapshot).filter((s) => loan && s.loanId === loan.id && (year == null || s.year === year)), // latest first
    [data, loan, year],
  );

  if (!loan) {
    return (
      <Panel className="mb-6">
        <EmptyState title="No active loans">Published loans appear here with their outstanding balance, EMI and repayment progress.</EmptyState>
      </Panel>
    );
  }

  const latest = snaps[0];
  const outstanding = latest?.outstandingAmount ?? loan.outstandingAmount;
  const repaid = Math.max(0, loan.principalAmount - outstanding);
  const repaidPct = loan.principalAmount > 0 ? (repaid / loan.principalAmount) * 100 : 0;
  const ageDays = latest ? Math.round((Date.now() - new Date(latest.snapshotDate || latest.updatedAt).getTime()) / 864e5) : null;
  const remaining = latest?.remainingTenureMonths ?? loan.tenureMonths;
  const rate = latest?.interestRate ?? loan.interestRate;
  const emi = latest?.emiAmount ?? loan.emiAmount;
  const now = new Date();
  const nextDue = new Date(now.getFullYear(), now.getMonth() + (now.getDate() > (loan.emiDate || 1) ? 1 : 0), Math.min(loan.emiDate || 1, 28));
  const end = new Date(now.getFullYear(), now.getMonth() + remaining, 1);
  const series = [...snaps].slice(0, year == null ? 8 : 12).reverse();
  const min = Math.min(...series.map((s) => s.outstandingAmount));
  const max = Math.max(...series.map((s) => s.outstandingAmount));
  const base = min - (max - min || min * 0.02) * 0.6;

  return (
    <div className="mb-6 space-y-4">
      <Panel>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="eyebrow">
              {titleCase(loan.type)}
              {loan.description ? ` · ${loan.description}` : ` · ${loan.name}`}
            </div>
            <div className="mt-2 text-[clamp(36px,5vw,60px)] font-bold leading-[1.05] tracking-[-0.035em]">{M(outstanding, 2)}</div>
            <p className="mt-2 text-[15px] text-muted">
              {latest ? (
                <>
                  Outstanding as of the {monthShort(latest.month)} {latest.year} snapshot
                  {year == null && (
                    <>
                      {' · '}
                      <span className={cn(ageDays != null && ageDays > 60 ? 'text-loss' : 'text-muted')}>data {ageDays} days old</span>
                    </>
                  )}
                </>
              ) : (
                <>Outstanding as recorded on {fmtDate(loan.updatedAt)}</>
              )}
            </p>
            <div className="mt-6">
              <div className="flex justify-between text-[14.5px]">
                <span>Principal repaid</span>
                <span className="tabular-nums">{repaidPct.toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, repaidPct)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[13px] text-muted">
                <span>{M(repaid)} repaid</span>
                <span>of {M(loan.principalAmount)} disbursed</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 self-start">
            <Metric eyebrow label="Monthly EMI" value={M(emi)} sub={`Next due ${fmtDate(nextDue)}`} />
            <Metric eyebrow label="Interest rate" value={`${rate}%`} sub={snaps.length > 1 && snaps.every((s) => s.interestRate === rate) ? `Unchanged since ${monthShort(snaps[snaps.length - 1]!.month)}` : 'Latest snapshot'} />
            <Metric
              eyebrow
              label="Remaining tenure"
              value={`${remaining} months`}
              sub={`${Math.floor(remaining / 12)} yr ${remaining % 12} mo · ends ${end.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`}
            />
            <Metric eyebrow label="Interest paid to date" value={latest ? M(latest.interestPaid) : '—'} sub="Lifetime, from latest snapshot" />
          </div>
        </div>
      </Panel>

      {series.length > 1 && (
        <Panel className="max-w-[880px]">
          <PanelHeader title={year == null ? 'Outstanding balance by month' : `Outstanding balance by month · ${year}`} />
          <div className="flex h-[150px] items-end gap-[clamp(10px,4vw,56px)] px-2">
            {series.map((s) => (
              <div key={s.id} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11.5px] tabular-nums text-muted">{C(s.outstandingAmount).replace(/^[^\d−]+/, '')}</span>
                <div className="w-full max-w-[56px] bg-accent-700" style={{ height: `${Math.max(6, ((s.outstandingAmount - base) / (max - base || 1)) * 100)}px` }} />
                <span className="text-[12.5px] font-medium">{monthShort(s.month)}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-muted">Bars start at {M(Math.max(0, base))} so monthly change is visible.</p>
        </Panel>
      )}
    </div>
  );
}
