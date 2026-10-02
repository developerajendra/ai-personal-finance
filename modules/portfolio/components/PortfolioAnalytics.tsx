'use client';

import { useMemo } from 'react';
import { formatIndianNumber } from '@/shared/utils/currency';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Home, Wallet, FileText } from 'lucide-react';
import { Loader } from '@/shared/components/Loader';

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#82ca9d',
];


export function PortfolioAnalytics() {
  // Export net worth calculation for use in DashboardModule
  return <PortfolioAnalyticsContent />;
}

export { usePortfolioData } from '@/shared/hooks/usePortfolioData';
import { usePortfolioData } from '@/shared/hooks/usePortfolioData';

function PortfolioAnalyticsContent() {
  const {
    totalInvestments,
    totalLoans,
    totalProperties,
    totalStocks,
    totalMutualFunds,
    totalPPF,
    totalBankBalances,
    totalReceivables,
    totalFixedAssets,
    totalLiquidAssets,
    netWorth,
    isLoading,
    investments,
    loans,
    properties,
    stocksData,
    mutualFundsData,
    ppfAccounts,
    bankBalances,
  } = usePortfolioData();

  // Calculate counts for each category
  const investmentsCount = investments.length;
  const loansCount = loans.length;
  const propertiesCount = properties.length;
  const stocksCount = stocksData?.stocks?.length || 0;
  const mutualFundsCount = mutualFundsData?.mutualFunds?.length || 0;
  const ppfCount = ppfAccounts.length;
  const bankBalancesCount = bankBalances.filter((bb: any) => !bb.tags?.includes('receivable')).length;
  const receivablesCount = bankBalances.filter((bb: any) => bb.tags?.includes('receivable')).length;

  const investmentChartData = useMemo(() => {
    const breakdown = investments.reduce((acc, inv) => {
      acc[inv.type] = (acc[inv.type] || 0) + inv.amount;
      return acc;
    }, {} as Record<string, number>);
    if (totalStocks > 0) breakdown['stocks'] = (breakdown['stocks'] || 0) + totalStocks;
    if (totalMutualFunds > 0) breakdown['mutual-fund'] = (breakdown['mutual-fund'] || 0) + totalMutualFunds;
    if (totalPPF > 0) breakdown['provident-fund'] = (breakdown['provident-fund'] || 0) + totalPPF;
    return Object.entries(breakdown).map(([name, value]) => ({
      name:
        name === 'provident-fund'
          ? 'Provident Fund'
          : name === 'mutual-fund'
          ? 'Mutual Fund'
          : name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [investments, totalStocks, totalMutualFunds, totalPPF]);

  const loanChartData = useMemo(
    () =>
      Object.entries(
        loans.reduce((acc, loan) => {
          acc[loan.type] = (acc[loan.type] || 0) + loan.outstandingAmount;
          return acc;
        }, {} as Record<string, number>)
      ).map(([name, value]) => ({ name, value })),
    [loans]
  );

  const propertyChartData = useMemo(
    () =>
      Object.entries(
        properties.reduce((acc, prop) => {
          const value = prop.currentValue || prop.purchasePrice || 0;
          if (value > 0 && prop.name) acc[prop.name] = (acc[prop.name] || 0) + value;
          return acc;
        }, {} as Record<string, number>)
      )
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
        }))
        .sort((a, b) => b.value - a.value),
    [properties]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading portfolio analytics..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* First Row: Net Worth, Liquid Assets, Fixed Assets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-accent to-accent-700 rounded-lg shadow-lg p-6 border border-accent-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-accent-300 font-medium">Net Worth</p>
              <p
                className={`text-2xl font-bold mt-2 truncate ${
                  netWorth >= 0 ? 'text-white' : 'text-loss'
                }`}>
                ₹{formatIndianNumber(netWorth)}
              </p>
            </div>
            <Wallet className="w-10 h-10 text-white flex-shrink-0 ml-2 opacity-80" />
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted">Liquid Assets</p>
              <p className="text-2xl font-bold text-gain mt-2 truncate">
                ₹{formatIndianNumber(totalLiquidAssets)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-gain flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted">Fixed Assets</p>
              <p className="text-2xl font-bold text-accent-700 mt-2 truncate">
                ₹{formatIndianNumber(totalFixedAssets)}
              </p>
            </div>
            <Home className="w-10 h-10 text-accent-700 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      {/* First Row: Total Investments, Total Loans, Total Properties */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted">
                Total Investments{investmentsCount > 0 && ` (${investmentsCount})`}
              </p>
              <p className="text-sm font-bold text-gain mt-2 truncate">
                ₹{formatIndianNumber(totalInvestments)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-gain flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted">
                Total Loans{loansCount > 0 && ` (${loansCount})`}
              </p>
              <p className="text-sm font-bold text-loss mt-2 truncate">
                ₹{formatIndianNumber(totalLoans)}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-loss flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted">
                Total Properties{propertiesCount > 0 && ` (${propertiesCount})`}
              </p>
              <p className="text-sm font-bold text-accent-700 mt-2 truncate">
                ₹{formatIndianNumber(totalProperties)}
              </p>
            </div>
            <Home className="w-8 h-8 text-accent-700 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      {/* Second Row: Stocks, Mutual Funds, PPF, Bank Balances, Receivables */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted">
                Stocks{stocksCount > 0 && ` (${stocksCount})`}
              </p>
              <p className="text-sm font-bold text-gain mt-2 truncate">
                ₹{formatIndianNumber(totalStocks)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-gain flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted">
                Mutual Funds{mutualFundsCount > 0 && ` (${mutualFundsCount})`}
              </p>
              <p className="text-sm font-bold text-accent-700 mt-2 truncate">
                ₹{formatIndianNumber(totalMutualFunds)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-accent-700 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted">
                Provident Fund{ppfCount > 0 && ` (${ppfCount})`}
              </p>
              <p className="text-sm font-bold text-gain mt-2 truncate">
                ₹{formatIndianNumber(totalPPF)}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-gain flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted">
                Bank Balances{bankBalancesCount > 0 && ` (${bankBalancesCount})`}
              </p>
              <p className="text-sm font-bold text-accent-700 mt-2 truncate">
                ₹{formatIndianNumber(totalBankBalances)}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-accent-700 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted">
                Receivables{receivablesCount > 0 && ` (${receivablesCount})`}
              </p>
              <p className="text-sm font-bold text-accent-700 mt-2 truncate">
                ₹{formatIndianNumber(totalReceivables)}
              </p>
            </div>
            <FileText className="w-8 h-8 text-accent-700 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {investmentChartData.length > 0 && (
          <div className="panel p-6">
            <h3 className="text-lg font-semibold mb-4">Investment Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={investmentChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value">
                  {investmentChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {loanChartData.length > 0 && (
          <div className="panel p-6">
            <h3 className="text-lg font-semibold mb-4">Loan Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={loanChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#FF8042" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {propertyChartData.length > 0 && (
          <div className="panel p-6">
            <h3 className="text-lg font-semibold mb-4">Property Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={propertyChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value">
                  {propertyChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₹${formatIndianNumber(value)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {investmentChartData.length === 0 &&
        loanChartData.length === 0 &&
        propertyChartData.length === 0 && (
          <div className="panel p-12 text-center">
            <p className="text-muted">
              No portfolio data available. Add investments, loans, and
              properties in the Admin Panel to see analytics.
            </p>
            {properties.length > 0 && (
              <p className="text-sm text-neutral-500 mt-2">
                Note: {properties.length} propert{properties.length === 1 ? 'y' : 'ies'} found but may not be published or have valid values.
              </p>
            )}
          </div>
        )}
    </div>
  );
}
