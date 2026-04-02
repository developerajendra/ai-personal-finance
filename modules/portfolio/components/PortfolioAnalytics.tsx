'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Investment, Loan, Property, BankBalance } from '@/core/types';
import { PPFAccount } from '@/core/services/ppfStorageService';
import { formatIndianNumber } from '@/core/services/currencyService';
import { getCurrentInvestmentValue } from '@/core/utils/investmentValueCalculator';
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

interface PortfolioSnapshot {
  investments: Investment[];
  loans: Loan[];
  properties: Property[];
  bankBalances: BankBalance[];
  stocks: any[];
  mutualFunds: any[];
  ppfAccounts: PPFAccount[];
}

export function PortfolioAnalytics() {
  // Export net worth calculation for use in DashboardModule
  return <PortfolioAnalyticsContent />;
}

export function usePortfolioData() {
  const { data, isLoading } = useQuery<PortfolioSnapshot>({
    queryKey: ['portfolio-snapshot'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/snapshot');
      if (!response.ok) throw new Error('Failed to fetch portfolio snapshot');
      return response.json();
    },
  });

  const investments = data?.investments ?? [];
  const loans = data?.loans ?? [];
  const properties = data?.properties ?? [];
  const bankBalances = data?.bankBalances ?? [];
  const stocks = data?.stocks ?? [];
  const mutualFunds = data?.mutualFunds ?? [];
  const ppfAccounts = data?.ppfAccounts ?? [];

  const stocksData = useMemo(() => ({ stocks }), [stocks]);
  const mutualFundsData = useMemo(() => ({ mutualFunds }), [mutualFunds]);

  const activeInvestments = useMemo(
    () => investments.filter((inv) => inv.status !== 'closed'),
    [investments]
  );

  const totalInvestments = useMemo(
    () => activeInvestments.reduce((sum, inv) => sum + getCurrentInvestmentValue(inv), 0),
    [activeInvestments]
  );
  const totalLoans = useMemo(
    () => loans.reduce((sum, loan) => sum + loan.outstandingAmount, 0),
    [loans]
  );
  const totalProperties = useMemo(
    () => properties.reduce((sum, prop) => sum + (prop.currentValue || prop.purchasePrice), 0),
    [properties]
  );
  const totalStocks = useMemo(
    () => stocks.reduce((sum, stock) => sum + ((stock.last_price || 0) * (stock.quantity || 0)), 0),
    [stocks]
  );
  const totalMutualFunds = useMemo(
    () => mutualFunds.reduce((sum, mf) => sum + ((mf.last_price || 0) * (mf.quantity || 0)), 0),
    [mutualFunds]
  );
  const totalPPF = useMemo(
    () => ppfAccounts.reduce((sum, account) => sum + (account.grandTotal || 0), 0),
    [ppfAccounts]
  );
  const totalBankBalances = useMemo(
    () =>
      bankBalances
        .filter((bb: any) => !bb.tags?.includes('receivable'))
        .reduce((sum, bb) => sum + (bb.balance || 0), 0),
    [bankBalances]
  );

  // Calculate receivables - use expected total if available, otherwise use balance
  const totalReceivables = useMemo(
    () =>
      bankBalances
        .filter((bb: any) => bb.tags?.includes('receivable'))
        .reduce((sum, bb: any) => {
          if (bb.interestRate && bb.issueDate) {
            const principal = bb.balance || 0;
            const interestRate = bb.interestRate / 100;
            const issueDate = new Date(bb.issueDate);
            const dueDate = bb.dueDate ? new Date(bb.dueDate) : new Date();
            const daysDiff = Math.max(0, Math.floor((dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
            const years = daysDiff / 365;
            const interestAmount = principal * interestRate * years;
            return sum + (principal + interestAmount);
          }
          return sum + (bb.balance || 0);
        }, 0),
    [bankBalances]
  );

  const fixedAssetsFromInvestments = useMemo(
    () =>
      activeInvestments.reduce(
        (sum, inv) => sum + (inv.assetType === 'fixed' ? getCurrentInvestmentValue(inv) : 0),
        0
      ),
    [activeInvestments]
  );

  const fixedAssetsFromProperties = useMemo(
    () =>
      properties.reduce((sum, prop) => {
        const value = prop.currentValue || prop.purchasePrice || 0;
        return sum + (prop.assetType === 'liquid' ? 0 : value);
      }, 0),
    [properties]
  );

  const fixedAssetsFromBankBalances = useMemo(
    () =>
      bankBalances
        .filter((bb: any) => !bb.tags?.includes('receivable') && bb.assetType === 'fixed')
        .reduce((sum, bb) => sum + (bb.balance || 0), 0),
    [bankBalances]
  );

  const totalFixedAssets = fixedAssetsFromInvestments + fixedAssetsFromProperties + fixedAssetsFromBankBalances;

  const liquidAssetsFromInvestments = useMemo(
    () =>
      activeInvestments.reduce(
        (sum, inv) => sum + (inv.assetType === 'fixed' ? 0 : getCurrentInvestmentValue(inv)),
        0
      ),
    [activeInvestments]
  );

  const liquidAssetsFromProperties = useMemo(
    () =>
      properties.reduce((sum, prop) => {
        const value = prop.currentValue || prop.purchasePrice || 0;
        return sum + (prop.assetType === 'liquid' ? value : 0);
      }, 0),
    [properties]
  );

  const liquidAssetsFromBankBalances = useMemo(
    () =>
      bankBalances
        .filter((bb: any) => {
          if (bb.tags?.includes('receivable')) return true;
          return bb.assetType !== 'fixed';
        })
        .reduce((sum, bb: any) => {
          if (bb.tags?.includes('receivable')) {
            if (bb.interestRate && bb.issueDate) {
              const principal = bb.balance || 0;
              const interestRate = bb.interestRate / 100;
              const issueDate = new Date(bb.issueDate);
              const dueDate = bb.dueDate ? new Date(bb.dueDate) : new Date();
              const daysDiff = Math.max(0, Math.floor((dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
              const years = daysDiff / 365;
              const interestAmount = principal * interestRate * years;
              return sum + (principal + interestAmount);
            }
            return sum + (bb.balance || 0);
          }
          return sum + (bb.balance || 0);
        }, 0),
    [bankBalances]
  );

  const totalLiquidAssets =
    liquidAssetsFromInvestments +
    liquidAssetsFromProperties +
    totalStocks +
    totalMutualFunds +
    totalPPF +
    liquidAssetsFromBankBalances;

  const totalAssetsFromCategories = totalFixedAssets + totalLiquidAssets;
  const netWorth = totalAssetsFromCategories - totalLoans;

  if (process.env.NODE_ENV === 'development') {
    const totalAllAssets =
      totalInvestments + totalProperties + totalStocks + totalMutualFunds + totalPPF + totalBankBalances + totalReceivables;
    const difference = Math.abs(totalAllAssets - totalAssetsFromCategories);
    if (difference > 0.01) {
      console.warn('⚠️ Asset calculation mismatch detected:', {
        'Total All Assets (sum of all categories)': totalAllAssets,
        'Total from Fixed + Liquid': totalAssetsFromCategories,
        'Difference': difference,
      });
    } else {
      console.log('✅ Net Worth calculation verified:', {
        'Fixed Assets': totalFixedAssets,
        'Liquid Assets': totalLiquidAssets,
        'Total Assets': totalAssetsFromCategories,
        'Loans': totalLoans,
        'Net Worth': netWorth,
      });
    }
  }

  return {
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
  };
}

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
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg shadow-lg p-6 border border-purple-300">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-purple-100 font-medium">Net Worth</p>
              <p
                className={`text-2xl font-bold mt-2 truncate ${
                  netWorth >= 0 ? 'text-white' : 'text-red-200'
                }`}>
                ₹{formatIndianNumber(netWorth)}
              </p>
            </div>
            <Wallet className="w-10 h-10 text-white flex-shrink-0 ml-2 opacity-80" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">Liquid Assets</p>
              <p className="text-2xl font-bold text-green-600 mt-2 truncate">
                ₹{formatIndianNumber(totalLiquidAssets)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-600 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">Fixed Assets</p>
              <p className="text-2xl font-bold text-blue-600 mt-2 truncate">
                ₹{formatIndianNumber(totalFixedAssets)}
              </p>
            </div>
            <Home className="w-10 h-10 text-blue-600 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      {/* First Row: Total Investments, Total Loans, Total Properties */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">
                Total Investments{investmentsCount > 0 && ` (${investmentsCount})`}
              </p>
              <p className="text-sm font-bold text-green-600 mt-2 truncate">
                ₹{formatIndianNumber(totalInvestments)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">
                Total Loans{loansCount > 0 && ` (${loansCount})`}
              </p>
              <p className="text-sm font-bold text-red-600 mt-2 truncate">
                ₹{formatIndianNumber(totalLoans)}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">
                Total Properties{propertiesCount > 0 && ` (${propertiesCount})`}
              </p>
              <p className="text-sm font-bold text-blue-600 mt-2 truncate">
                ₹{formatIndianNumber(totalProperties)}
              </p>
            </div>
            <Home className="w-8 h-8 text-blue-600 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      {/* Second Row: Stocks, Mutual Funds, PPF, Bank Balances, Receivables */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">
                Stocks{stocksCount > 0 && ` (${stocksCount})`}
              </p>
              <p className="text-sm font-bold text-emerald-600 mt-2 truncate">
                ₹{formatIndianNumber(totalStocks)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-600 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">
                Mutual Funds{mutualFundsCount > 0 && ` (${mutualFundsCount})`}
              </p>
              <p className="text-sm font-bold text-purple-600 mt-2 truncate">
                ₹{formatIndianNumber(totalMutualFunds)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">
                Provident Fund{ppfCount > 0 && ` (${ppfCount})`}
              </p>
              <p className="text-sm font-bold text-green-600 mt-2 truncate">
                ₹{formatIndianNumber(totalPPF)}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-green-600 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">
                Bank Balances{bankBalancesCount > 0 && ` (${bankBalancesCount})`}
              </p>
              <p className="text-sm font-bold text-indigo-600 mt-2 truncate">
                ₹{formatIndianNumber(totalBankBalances)}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-indigo-600 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">
                Receivables{receivablesCount > 0 && ` (${receivablesCount})`}
              </p>
              <p className="text-sm font-bold text-teal-600 mt-2 truncate">
                ₹{formatIndianNumber(totalReceivables)}
              </p>
            </div>
            <FileText className="w-8 h-8 text-teal-600 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {investmentChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
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
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
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
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
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
          <div className="bg-white rounded-lg shadow p-12 border border-gray-200 text-center">
            <p className="text-gray-500">
              No portfolio data available. Add investments, loans, and
              properties in the Admin Panel to see analytics.
            </p>
            {properties.length > 0 && (
              <p className="text-sm text-gray-400 mt-2">
                Note: {properties.length} propert{properties.length === 1 ? 'y' : 'ies'} found but may not be published or have valid values.
              </p>
            )}
          </div>
        )}
    </div>
  );
}
