'use client';

import { useFinancialData } from '@/shared/hooks/useFinancialData';
import { FinancialCharts } from './FinancialCharts';
import { TransactionTable } from './TransactionTable';
import { PortfolioAnalytics } from '@/modules/portfolio/components/PortfolioAnalytics';
import { Loader } from '@/shared/components/Loader';

export function DashboardModule() {
  const { transactions, summary, isLoading } = useFinancialData();

  if (isLoading) {
    return (
      <div className="p-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            View your financial overview and insights
          </p>
        </div>
        <div className="mt-8">
          <Loader text="Loading dashboard data..." size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          View your financial overview and insights
        </p>
      </div>

      <PortfolioAnalytics />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinancialCharts transactions={transactions} summary={summary} />
        <TransactionTable transactions={transactions} />
      </div>
    </div>
  );
}

