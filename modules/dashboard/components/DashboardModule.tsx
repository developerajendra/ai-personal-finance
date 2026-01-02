"use client";

import { useFinancialData } from "@/shared/hooks/useFinancialData";
import { SummaryCards } from "./SummaryCards";
import { FinancialCharts } from "./FinancialCharts";
import { TransactionTable } from "./TransactionTable";
import { PortfolioAnalytics } from "@/modules/portfolio/components/PortfolioAnalytics";

export function DashboardModule() {
  const { transactions, summary } = useFinancialData();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          View your financial overview and insights
        </p>
      </div>

      <SummaryCards summary={summary} />

      <div>
        <h2 className="text-2xl font-semibold mb-4">Portfolio Analytics</h2>
        <PortfolioAnalytics />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinancialCharts transactions={transactions} summary={summary} />
        <TransactionTable transactions={transactions} />
      </div>
    </div>
  );
}

