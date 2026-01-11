import { NextRequest, NextResponse } from 'next/server';
import {
  getLoanSnapshotsByYear,
  getLoanSnapshotsByMonth,
  getLoanSnapshots,
  getAvailableYearsForLoans,
  getAvailableMonthsForLoans,
  getLoansWithSnapshots,
  getLoanSnapshot,
  calculateLoanGrowthMetrics,
  getPreviousLoanSnapshot,
} from '@/core/services/loanAnalyticsService';
import { LoanMonthlySnapshot } from '@/core/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const loanId = searchParams.get('loanId');

    // Get available years
    if (action === 'years') {
      const years = getAvailableYearsForLoans();
      return NextResponse.json({ years });
    }

    // Get available months for a year
    if (action === 'months' && year) {
      const yearNum = parseInt(year);
      const months = getAvailableMonthsForLoans(yearNum);
      return NextResponse.json({ months });
    }

    // Get loans with snapshots for a year
    if (action === 'loans' && year) {
      const yearNum = parseInt(year);
      const loanIds = getLoansWithSnapshots(yearNum);
      return NextResponse.json({ loanIds });
    }

    // Get specific snapshot
    if (loanId && year && month) {
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const snapshot = getLoanSnapshot(loanId, yearNum, monthNum);
      
      if (!snapshot) {
        return NextResponse.json(
          { error: 'Snapshot not found' },
          { status: 404 }
        );
      }

      // Calculate growth metrics
      const previous = getPreviousLoanSnapshot(snapshot);
      const growth = calculateLoanGrowthMetrics(snapshot, previous || undefined);

      return NextResponse.json({
        snapshot,
        growth,
      });
    }

    // Get snapshots by loan and year
    if (loanId && year) {
      const yearNum = parseInt(year);
      const snapshots = getLoanSnapshotsByYear(loanId, yearNum);
      
      // Calculate growth metrics for each snapshot
      const snapshotsWithGrowth = snapshots.map(snapshot => {
        const previous = getPreviousLoanSnapshot(snapshot);
        const growth = calculateLoanGrowthMetrics(snapshot, previous || undefined);
        return { snapshot, growth };
      });

      return NextResponse.json({ snapshots: snapshotsWithGrowth });
    }

    // Get snapshots by month (all loans)
    if (year && month) {
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const snapshots = getLoanSnapshotsByMonth(yearNum, monthNum);
      
      // Calculate growth metrics for each snapshot
      const snapshotsWithGrowth = snapshots.map(snapshot => {
        const previous = getPreviousLoanSnapshot(snapshot);
        const growth = calculateLoanGrowthMetrics(snapshot, previous || undefined);
        return { snapshot, growth };
      });

      return NextResponse.json({ snapshots: snapshotsWithGrowth });
    }

    // Get all snapshots for a loan
    if (loanId) {
      const snapshots = getLoanSnapshots(loanId);
      return NextResponse.json({ snapshots });
    }

    // Get all snapshots for a year (all loans)
    if (year) {
      const yearNum = parseInt(year);
      const loanIds = getLoansWithSnapshots(yearNum);
      const allSnapshots: Array<{ snapshot: LoanMonthlySnapshot; growth: any }> = [];
      
      for (const id of loanIds) {
        const snapshots = getLoanSnapshotsByYear(id, yearNum);
        snapshots.forEach(snapshot => {
          const previous = getPreviousLoanSnapshot(snapshot);
          const growth = calculateLoanGrowthMetrics(snapshot, previous || undefined);
          allSnapshots.push({ snapshot, growth });
        });
      }

      // Sort by month
      allSnapshots.sort((a, b) => {
        if (a.snapshot.month !== b.snapshot.month) {
          return a.snapshot.month - b.snapshot.month;
        }
        return a.snapshot.loanId.localeCompare(b.snapshot.loanId);
      });

      return NextResponse.json({ snapshots: allSnapshots });
    }

    // Default: return available years
    const years = getAvailableYearsForLoans();
    return NextResponse.json({ years, message: 'Use ?year=YYYY&month=MM&loanId=xxx to get specific snapshots' });
  } catch (error: any) {
    console.error('Error fetching loan analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch loan analytics' },
      { status: 500 }
    );
  }
}
