import { NextResponse } from "next/server";
import { FinancialSummary } from "@/core/types";

export async function GET() {
  // In production, calculate from database
  const summary: FinancialSummary = {
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    categoryBreakdown: {},
  };

  return NextResponse.json(summary);
}

