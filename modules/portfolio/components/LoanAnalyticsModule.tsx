'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoanMonthlySnapshot, Loan } from '@/shared/types';
import { formatIndianNumber } from '@/shared/utils/currency';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  CreditCard,
  Percent,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Loader } from '@/shared/components/Loader';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const PAYMENT_DAY = 4; // Loan EMI is paid on the 4th of every month

/** Loads every loan snapshot across all years, latest first (shared by the loan hero). */
export async function fetchLoanSnapshots(): Promise<{ snapshots: Array<{ snapshot: LoanMonthlySnapshot; growth: any }> }> {
  // Get all available years first
  const yearsResponse = await fetch('/api/loans/analytics?action=years');
  if (!yearsResponse.ok) {
    return { snapshots: [] };
  }
  const yearsData = await yearsResponse.json();
  const years = yearsData.years || [];

  // Fetch snapshots for all years
  const allSnapshots: Array<{
    snapshot: LoanMonthlySnapshot;
    growth: any;
  }> = [];
  for (const year of years) {
    const response = await fetch(`/api/loans/analytics?year=${year}`);
    if (response.ok) {
      const data = await response.json();
      if (data.snapshots) {
        allSnapshots.push(...data.snapshots);
      }
    }
  }

  // Sort by year and month (latest first)
  allSnapshots.sort((a, b) => {
    if (a.snapshot.year !== b.snapshot.year) {
      return b.snapshot.year - a.snapshot.year;
    }
    return b.snapshot.month - a.snapshot.month;
  });

  return { snapshots: allSnapshots };
}

/** Snapshot analytics; `loanId` / `year` come from the loans page filter (null = no filter). */
export function LoanAnalyticsModule({ loanId = null, year = null }: { loanId?: string | null; year?: number | null } = {}) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const dayOfMonth = new Date().getDate();
  const shouldAutoUpdate = dayOfMonth >= PAYMENT_DAY;
  const queryClient = useQueryClient();
  const autoUpdateRan = useRef(false);

  // Auto-update: generate missing monthly snapshots when date >= 4th
  useEffect(() => {
    if (!shouldAutoUpdate || autoUpdateRan.current) return;
    autoUpdateRan.current = true;

    const run = async () => {
      try {
        console.log('[LoanAnalytics] Auto-updating missing monthly snapshots...');
        const res = await fetch('/api/loans/auto-update', { method: 'POST' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.generated > 0) {
          console.log(`[LoanAnalytics] Generated ${data.generated} snapshot(s), refreshing...`);
          queryClient.invalidateQueries({ queryKey: ['loan-analytics-snapshots'] });
        }
      } catch {
        // Silently ignore - this is a best-effort background update
      }
    };
    run();
  }, [shouldAutoUpdate, queryClient]);

  // Fetch loans to get loan names
  const { data: loansData } = useQuery<Loan[]>({
    queryKey: ['loans'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/loans');
      if (!response.ok) throw new Error('Failed to fetch loans');
      return response.json();
    },
  });

  // Fetch all snapshots (latest first)
  const { data: snapshotsData, isLoading } = useQuery<{
    snapshots: Array<{ snapshot: LoanMonthlySnapshot; growth: any }>;
  }>({
    queryKey: ['loan-analytics-snapshots'],
    queryFn: fetchLoanSnapshots,
  });

  const snapshots = (snapshotsData?.snapshots || []).filter(
    (x) => (loanId == null || x.snapshot.loanId === loanId) && (year == null || x.snapshot.year === year),
  );
  const loans = loansData || [];

  // Group snapshots by year and month (show latest first)
  const snapshotMap = new Map<
    string,
    Array<{ snapshot: LoanMonthlySnapshot; growth: any }>
  >();
  snapshots.forEach((item) => {
    const key = `${item.snapshot.year}-${item.snapshot.month}`;
    if (!snapshotMap.has(key)) {
      snapshotMap.set(key, []);
    }
    snapshotMap.get(key)!.push(item);
  });

  // Get all snapshot keys sorted (latest first)
  const snapshotKeys = Array.from(snapshotMap.keys()).sort((a, b) => {
    const [yearA, monthA] = a.split('-').map(Number);
    const [yearB, monthB] = b.split('-').map(Number);
    if (yearA !== yearB) return yearB - yearA;
    return monthB - monthA;
  });

  // Calculate year totals
  const yearTotals = snapshots.reduce(
    (acc, item) => {
      acc.totalOutstanding += item.snapshot.outstandingAmount;
      acc.totalPrincipalPaid += item.snapshot.principalPaid;
      acc.totalInterestPaid += item.snapshot.interestPaid;
      return acc;
    },
    {
      totalOutstanding: 0,
      totalPrincipalPaid: 0,
      totalInterestPaid: 0,
    },
  );

  const avgOutstanding =
    snapshots.length > 0 ? yearTotals.totalOutstanding / snapshots.length : 0;

  if (isLoading) {
    return (
      <div>
        <div className="mt-8">
          <Loader text="Loading loan analytics..." size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Header */}
      {snapshots.length > 0 && (
        <div className="mt-4 panel px-6 py-[22px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[19px] text-ink">Loan analytics summary</h2>
              <p className="text-muted text-[13.5px] mt-1">
                {snapshots.length} snapshot
                {snapshots.length !== 1 ? 's' : ''} recorded{year != null && ` in ${year}`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="eyebrow">
                  Latest Outstanding
                </p>
                <p className="text-xl font-bold text-ink mt-1">
                  {formatIndianNumber(
                    snapshots[0]?.snapshot.outstandingAmount || 0,
                  )}
                </p>
              </div>
              <div className="w-px h-12 bg-divider"></div>
              <div className="text-right">
                <p className="eyebrow">
                  Total Principal Paid
                </p>
                <p className="text-xl font-bold text-ink mt-1">
                  {formatIndianNumber(yearTotals.totalPrincipalPaid)}
                </p>
              </div>
              <div className="w-px h-12 bg-divider"></div>
              <div className="text-right">
                <p className="eyebrow">
                  Total Interest Paid
                </p>
                <p className="text-xl font-bold text-ink mt-1">
                  {formatIndianNumber(yearTotals.totalInterestPaid)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Grid */}
      {snapshotKeys.length === 0 ? (
        <div className="mt-4 bg-warn-bg rounded-panel p-6 text-center">
          <p className="text-warn mb-4">
            No snapshots for this loan yet. Click “Fetch quarterly
            summary” to process the latest email.
          </p>
        </div>
      ) : (
        <div className="mt-4 panel overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-8 gap-3 p-3 bg-tile font-semibold text-[11.5px] uppercase tracking-wide text-muted">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Month</span>
            </div>
            <div className="flex items-center gap-1">
              <Wallet className="w-3 h-3 text-accent-700" />
              <span>Outstanding</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-gain" />
              <span>Principal Paid</span>
            </div>
            <div className="flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-loss" />
              <span>Interest Paid till date</span>
            </div>
            <div className="flex items-center gap-1">
              <Wallet className="w-3 h-3 text-accent-700" />
              <span>EMI Amount</span>
            </div>
            <div className="flex items-center gap-1">
              <Percent className="w-3 h-3 text-warn" />
              <span>Interest Rate</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-accent-700" />
              <span>Remaining Tenure</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted" />
              <span>Last Updated</span>
            </div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-divider">
            {snapshotKeys.map((key) => {
              const [year, month] = key.split('-').map(Number);
              const monthSnapshots = snapshotMap.get(key) || [];
              return monthSnapshots.map((item, index) => {
                const { snapshot, growth } = item;
                const loan = loans.find((l) => l.id === snapshot.loanId);
                const loanName = loan?.name || 'Unknown Loan';

                return (
                  <LoanMonthRow
                    key={`${snapshot.id}-${index}`}
                    month={month}
                    monthName={FULL_MONTHS[month - 1]}
                    year={year}
                    snapshot={snapshot}
                    growth={growth}
                    loanName={loanName}
                    isCurrentMonth={
                      month === currentMonth && year === currentYear
                    }
                  />
                );
              });
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LoanMonthRow({
  month,
  monthName,
  year,
  snapshot,
  growth,
  loanName,
  isCurrentMonth,
}: {
  month: number;
  monthName: string;
  year: number;
  snapshot: LoanMonthlySnapshot;
  growth: any;
  loanName: string;
  isCurrentMonth: boolean;
}) {
  const formatDifference = (value: number, isPercent: boolean = false) => {
    const isPositive = value >= 0;
    const absValue = Math.abs(value);
    return {
      value: absValue,
      isPositive,
      sign: isPositive ? '+' : '-',
      display: isPercent
        ? `${isPositive ? '+' : ''}${absValue.toFixed(2)}%`
        : `${isPositive ? '+' : ''}${formatIndianNumber(absValue)}`,
    };
  };

  const outstandingDiff = growth?.outstandingAmountChange
    ? formatDifference(growth.outstandingAmountChange)
    : null;
  const principalDiff = growth?.principalPaidChange
    ? formatDifference(growth.principalPaidChange)
    : null;
  const interestDiff = growth?.interestPaidChange
    ? formatDifference(growth.interestPaidChange)
    : null;
  const rateDiff = growth?.interestRateChange
    ? formatDifference(growth.interestRateChange)
    : null;
  const tenureDiff = growth?.tenureChange
    ? formatDifference(growth.tenureChange)
    : null;

  return (
    <div
      className={`grid grid-cols-8 gap-3 p-3 hover:bg-tile transition-colors border-l-4 ${
        isCurrentMonth
          ? 'bg-accent-100 border-accent'
          : 'bg-panel border-gain'
      }`}>
      {/* Month Column */}
      <div className="flex items-center min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-gain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">
              {MONTHS[month - 1]} {year}
            </p>
            <p className="text-sm font-semibold text-ink truncate">
              {monthName} {year}
            </p>
            <p className="text-xs text-muted truncate">{loanName}</p>
            {isCurrentMonth && (
              <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-accent-100 text-accent-700 text-xs font-medium rounded">
                Latest
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Outstanding Amount Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-accent-700">
            {formatIndianNumber(snapshot.outstandingAmount)}
          </p>
          {outstandingDiff && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {outstandingDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-gain" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-loss" />
              )}
              <span
                className={`text-xs font-medium ${
                  outstandingDiff.isPositive ? 'text-gain' : 'text-loss'
                }`}>
                {outstandingDiff.sign}
                {formatIndianNumber(outstandingDiff.value)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Principal Paid Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-gain">
            {formatIndianNumber(snapshot.principalPaid)}
          </p>
          {principalDiff && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {principalDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-gain" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-loss" />
              )}
              <span
                className={`text-xs font-medium ${
                  principalDiff.isPositive ? 'text-gain' : 'text-loss'
                }`}>
                {principalDiff.sign}
                {formatIndianNumber(principalDiff.value)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Interest Paid Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-loss">
            {formatIndianNumber(snapshot.interestPaid)}
          </p>
          {interestDiff && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {interestDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-gain" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-loss" />
              )}
              <span
                className={`text-xs font-medium ${
                  interestDiff.isPositive ? 'text-gain' : 'text-loss'
                }`}>
                {interestDiff.sign}
                {formatIndianNumber(interestDiff.value)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* EMI Amount Column */}
      <div className="flex items-center">
        <p className="text-sm font-semibold text-accent-700">
          {formatIndianNumber(snapshot.emiAmount)}
        </p>
      </div>

      {/* Interest Rate Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-warn">
            {snapshot.interestRate.toFixed(2)}%
          </p>
          {rateDiff && rateDiff.value > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {rateDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-loss" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-gain" />
              )}
              <span
                className={`text-xs font-medium ${
                  rateDiff.isPositive ? 'text-loss' : 'text-gain'
                }`}>
                {rateDiff.sign}
                {rateDiff.value.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Remaining Tenure Column */}
      <div className="flex items-center">
        <div>
          <p className="text-sm font-semibold text-accent-700">
            {snapshot.remainingTenureMonths} months
          </p>
          {tenureDiff && tenureDiff.value > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {tenureDiff.isPositive ? (
                <TrendingUp className="w-2.5 h-2.5 text-loss" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5 text-gain" />
              )}
              <span
                className={`text-xs font-medium ${
                  tenureDiff.isPositive ? 'text-loss' : 'text-gain'
                }`}>
                {tenureDiff.sign}
                {tenureDiff.value} months
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Last Updated Column */}
      <div className="flex items-center">
        <div className="text-xs text-muted">
          <p className="font-medium">
            {new Date(snapshot.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <p className="text-muted mt-0.5">
            {new Date(snapshot.updatedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
