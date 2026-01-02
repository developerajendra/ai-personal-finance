import { NextResponse } from "next/server";
import { PortfolioSummary } from "@/core/types";

export async function GET() {
  // In production, fetch from database and calculate
  const summary: PortfolioSummary = {
    totalInvestments: 0,
    totalLoans: 0,
    totalProperties: 0,
    netWorth: 0,
    investmentBreakdown: {},
    loanBreakdown: {},
    propertyBreakdown: {},
  };

  return NextResponse.json(summary);
}

