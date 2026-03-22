import { NextResponse } from "next/server";
import { saveSnapshot } from "@/core/services/archiveService";
import { FinancialSnapshot } from "@/core/types";
import {
  calculateSnapshotAsOfDate,
  validateSnapshot,
} from "@/core/services/snapshotCalculatorService";

// POST: Create snapshot with date-accurate historical calculation
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { year, month } = body;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const snapshotYear = year ?? currentYear;
    const snapshotMonth = month ?? (snapshotYear === currentYear ? currentMonth : undefined);

    // Past years: yearly snapshot. Current/future: monthly snapshot
    const isPastYear = snapshotYear < 2025;
    const finalMonth = isPastYear
      ? undefined
      : snapshotMonth ?? (snapshotYear === 2025 ? 12 : currentMonth);

    const snapshotData = calculateSnapshotAsOfDate(snapshotYear, finalMonth);

    // Create snapshot date (end of month for monthly, end of year for yearly)
    let snapshotDate: string;
    if (finalMonth) {
      // Last day of the month at end of day
      const lastDay = new Date(snapshotYear, finalMonth, 0);
      lastDay.setHours(23, 59, 59, 999);
      snapshotDate = lastDay.toISOString();
    } else {
      // Last day of the year
      const lastDay = new Date(snapshotYear, 11, 31);
      lastDay.setHours(23, 59, 59, 999);
      snapshotDate = lastDay.toISOString();
    }

    const defaults: FinancialSnapshot = {
      id: `${snapshotYear}-${finalMonth || "year"}-${Date.now()}`,
      year: snapshotYear,
      month: finalMonth,
      period: finalMonth ? "monthly" : "yearly",
      snapshotDate,
      totalInvestments: 0,
      totalLoans: 0,
      totalProperties: 0,
      totalBankBalances: 0,
      totalReceivables: 0,
      totalStocks: 0,
      totalMutualFunds: 0,
      totalPPF: 0,
      totalFixedAssets: 0,
      totalLiquidAssets: 0,
      netWorth: 0,
      totalIncome: 0,
      totalExpenses: 0,
      netBalance: 0,
      investmentBreakdown: {},
      loanBreakdown: {},
      propertyBreakdown: {},
      categoryBreakdown: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const snapshot: FinancialSnapshot = { ...defaults, ...snapshotData };

    const validation = validateSnapshot(snapshot);
    if (!validation.valid) {
      console.warn("Snapshot validation issues:", validation.errors);
    }

    const saved = saveSnapshot(snapshot);

    return NextResponse.json(
      {
        success: true,
        snapshot: saved,
        message: `Snapshot created for ${finalMonth ? `${getMonthName(finalMonth)} ${snapshotYear}` : snapshotYear}`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating snapshot:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create snapshot" },
      { status: 500 }
    );
  }
}

function getMonthName(month: number): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[month - 1] || "";
}
