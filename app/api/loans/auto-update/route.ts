import { NextRequest, NextResponse } from 'next/server';
import {
  loadLoanSnapshots,
  generateMissingMonthlySnapshots,
} from '@/core/services/loanAnalyticsService';
import { loadFromJson } from '@/core/services/jsonStorageService';
import { Loan, LoanMonthlySnapshot } from '@/core/types';

const PAYMENT_DAY = 4; // Loan payment happens on the 4th of every month

export async function POST(request: NextRequest) {
  try {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Only auto-generate if today is on or after payment day
    if (dayOfMonth < PAYMENT_DAY) {
      return NextResponse.json({
        success: true,
        generated: 0,
        message: `Today is ${dayOfMonth}th, before payment day (${PAYMENT_DAY}th). No auto-update needed.`,
      });
    }

    // Load all loans
    const loans = loadFromJson<Loan>('loans').filter((l) => l.isPublished);
    if (loans.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        message: 'No published loans found.',
      });
    }

    const allSnapshots = loadLoanSnapshots();
    let totalGenerated = 0;
    const generatedDetails: Array<{ loanId: string; loanName: string; year: number; month: number }> = [];

    for (const loan of loans) {
      // Get all snapshots for this loan, sorted chronologically
      const loanSnapshots = allSnapshots
        .filter((s) => s.loanId === loan.id)
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });

      if (loanSnapshots.length === 0) {
        continue; // No existing data to extrapolate from
      }

      // Find the latest snapshot for this loan
      const lastSnapshot = loanSnapshots[loanSnapshots.length - 1];

      // Check if the current month already has a snapshot
      const hasCurrentMonth = loanSnapshots.some(
        (s) => s.year === currentYear && s.month === currentMonth
      );

      if (hasCurrentMonth) {
        continue; // Already up to date
      }

      // Generate missing monthly snapshots up to the current month
      const generated = generateMissingMonthlySnapshots(
        loan.id,
        lastSnapshot,
        currentYear,
        currentMonth
      );

      totalGenerated += generated.length;
      for (const g of generated) {
        generatedDetails.push({
          loanId: loan.id,
          loanName: loan.name || loan.id,
          year: g.year,
          month: g.month,
        });
      }
    }

    console.log(`[Loan Auto-Update] Generated ${totalGenerated} missing monthly snapshot(s)`);

    return NextResponse.json({
      success: true,
      generated: totalGenerated,
      details: generatedDetails,
      message: totalGenerated > 0
        ? `Generated ${totalGenerated} estimated monthly snapshot(s) for current period.`
        : 'All loans are up to date for the current month.',
    });
  } catch (error: any) {
    console.error('[Loan Auto-Update] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to auto-update loan snapshots',
      },
      { status: 500 }
    );
  }
}
