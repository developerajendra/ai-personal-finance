'use client';

import { useFinancialData } from '@/shared/hooks/useFinancialData';
import { SummaryCards } from './SummaryCards';
import { FinancialCharts } from './FinancialCharts';
import { TransactionTable } from './TransactionTable';
import {
  PortfolioAnalytics,
  usePortfolioData,
} from '@/modules/portfolio/components/PortfolioAnalytics';
import { Loader } from '@/shared/components/Loader';
import { Wallet } from 'lucide-react';

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

      <SummaryCardsWithNetWorth summary={summary} />

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

function SummaryCardsWithNetWorth({ summary }: { summary: any }) {
  const { netWorth, isLoading } = usePortfolioData();
  
  return <SummaryCards summary={summary} netWorth={netWorth} isLoadingNetWorth={isLoading} />;
}
