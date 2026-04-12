'use client';

import { useState } from 'react';
import { useDashboardData } from '@/shared/hooks/useDashboardData';
import { NetWorthHero } from './NetWorthHero';
import { KPICards } from './KPICards';
import { CashFlowChart } from './CashFlowChart';
import { AssetAllocationChart } from './AssetAllocationChart';
import { InvestmentBreakdownChart } from './InvestmentBreakdownChart';
import { LoanHealthWidget } from './LoanHealthWidget';
import { FinancialRatiosWidget } from './FinancialRatiosWidget';
import { RecentTransactionsWidget } from './RecentTransactionsWidget';
import { QuickActionsPanel } from './QuickActionsPanel';
import { AssetBreakdownModal } from './AssetBreakdownModal';

type ModalType = 'fixed' | 'liquid' | 'loans' | null;

export function DashboardModule() {
  const data = useDashboardData();
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const lastUpdated = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">

      {/* Asset Breakdown Modal */}
      <AssetBreakdownModal
        open={activeModal}
        onClose={() => setActiveModal(null)}
        fixedAssetItems={data.fixedAssetItems}
        liquidAssetItems={data.liquidAssetItems}
        loans={data.loans as any}
        totalFixedAssets={data.totalFixedAssets}
        totalLiquidAssets={data.totalLiquidAssets}
        totalLoans={data.totalLoans}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">{todayStr}</p>
        </div>
        <p className="text-xs text-gray-300 mt-1.5">Updated {lastUpdated}</p>
      </div>

      {/* Net Worth Hero */}
      <NetWorthHero
        netWorth={data.netWorth}
        totalFixedAssets={data.totalFixedAssets}
        totalLiquidAssets={data.totalLiquidAssets}
        totalLoans={data.totalLoans}
        totalAssets={data.totalAssets}
        isLoading={data.isLoading}
        onCardClick={setActiveModal}
      />

      {/* KPI Cards — current month */}
      <KPICards
        currentMonthIncome={data.currentMonthIncome}
        currentMonthExpenses={data.currentMonthExpenses}
        savingsRate={data.savingsRate}
        currentMonthCashFlow={data.currentMonthCashFlow}
        prevMonthIncome={data.prevMonthIncome}
        prevMonthExpenses={data.prevMonthExpenses}
        monthlyInvestmentIncome={data.monthlyInvestmentIncome}
        investmentIncomeBreakdown={data.investmentIncomeBreakdown}
        isLoading={data.isLoading}
      />

      {/* Row 2: Cash Flow Trend (2/3) + Asset Allocation (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CashFlowChart
            monthlyTrend={data.monthlyTrend}
            isLoading={data.isLoading}
          />
        </div>
        <div className="lg:col-span-1">
          <AssetAllocationChart
            assetAllocation={data.assetAllocation}
            totalAssets={data.totalAssets}
            isLoading={data.isLoading}
          />
        </div>
      </div>

      {/* Row 3: Investment Breakdown + Loan Health + Financial Ratios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <InvestmentBreakdownChart
          investmentBreakdown={data.investmentBreakdown}
          isLoading={data.isLoading}
        />
        <LoanHealthWidget
          loanHealth={data.loanHealth}
          isLoading={data.isLoading}
        />
        <FinancialRatiosWidget
          debtToAssetRatio={data.debtToAssetRatio}
          liquidityRatio={data.liquidityRatio}
          savingsRate={data.savingsRate}
          isLoading={data.isLoading}
        />
      </div>

      {/* Row 4: Recent Transactions (2/3) + Quick Actions (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentTransactionsWidget
            transactions={data.recentTransactions}
            isLoading={data.isLoading}
          />
        </div>
        <div className="lg:col-span-1">
          <QuickActionsPanel />
        </div>
      </div>

    </div>
  );
}

