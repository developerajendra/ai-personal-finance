'use client';

import { useQuery } from '@tanstack/react-query';
import { Investment, Loan, Property, PortfolioSummary, BankBalance } from '@/core/types';
import { PPFAccount } from '@/core/services/ppfStorageService';
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

export function usePortfolioData() {
  const { data: investments = [], isLoading: isLoadingInvestments } = useQuery<
    Investment[]
  >({
    queryKey: ['investments', 'published'],
    queryFn: async () => {
      const response = await fetch(
        '/api/portfolio/investments?isPublished=true'
      );
      if (!response.ok) throw new Error('Failed to fetch investments');
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const { data: loans = [], isLoading: isLoadingLoans } = useQuery<Loan[]>({
    queryKey: ['loans', 'published'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/loans?isPublished=true');
      if (!response.ok) throw new Error('Failed to fetch loans');
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const { data: properties = [], isLoading: isLoadingProperties } = useQuery<
    Property[]
  >({
    queryKey: ['properties', 'published'],
    queryFn: async () => {
      const response = await fetch(
        '/api/portfolio/properties?isPublished=true'
      );
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const { data: stocksData, isLoading: isLoadingStocks } = useQuery<{ stocks: any[] }>({
    queryKey: ['stocks'],
    queryFn: async () => {
      const response = await fetch('/api/zerodha/stocks');
      if (!response.ok) return { stocks: [] };
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const { data: mutualFundsData, isLoading: isLoadingMutualFunds } = useQuery<{ mutualFunds: any[] }>({
    queryKey: ['mutualFunds'],
    queryFn: async () => {
      const response = await fetch('/api/zerodha/mutual-funds');
      if (!response.ok) return { mutualFunds: [] };
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const { data: bankBalances = [], isLoading: isLoadingBankBalances } = useQuery<BankBalance[]>({
    queryKey: ['bankBalances', 'published'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/bank-balances?isPublished=true');
      if (!response.ok) return [];
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const { data: ppfAccounts = [], isLoading: isLoadingPPF } = useQuery<PPFAccount[]>({
    queryKey: ['ppfAccounts'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/ppf-accounts');
      if (!response.ok) return [];
      return response.json();
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const isLoading =
    isLoadingInvestments || isLoadingLoans || isLoadingProperties || isLoadingStocks || isLoadingMutualFunds || isLoadingBankBalances || isLoadingPPF;

  const totalInvestments = investments.reduce(
    (sum, inv) => sum + inv.amount,
    0
  );
  const totalLoans = loans.reduce(
    (sum, loan) => sum + loan.outstandingAmount,
    0
  );
  const totalProperties = properties.reduce(
    (sum, prop) => sum + (prop.currentValue || prop.purchasePrice),
    0
  );
  const totalStocks = stocksData?.stocks?.reduce(
    (sum, stock) => sum + ((stock.last_price || 0) * (stock.quantity || 0)),
    0
  ) || 0;
  const totalMutualFunds = mutualFundsData?.mutualFunds?.reduce(
    (sum, mf) => sum + ((mf.last_price || 0) * (mf.quantity || 0)),
    0
  ) || 0;
  const totalPPF = ppfAccounts.reduce(
    (sum, account) => sum + (account.grandTotal || 0),
    0
  );
  const totalBankBalances = bankBalances
    .filter((bb: any) => !bb.tags?.includes('receivable')) // Exclude receivables
    .reduce((sum, bb) => sum + (bb.balance || 0), 0);
  
  // Calculate receivables - use expected total if available, otherwise use balance
  const totalReceivables = bankBalances
    .filter((bb: any) => bb.tags?.includes('receivable'))
    .reduce((sum, bb: any) => {
      // If interest exists, calculate expected total
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
      // Otherwise, just use the balance (principal amount)
      return sum + (bb.balance || 0);
    }, 0);
  
  const netWorth = totalInvestments + totalProperties + totalStocks + totalMutualFunds + totalPPF + totalBankBalances + totalReceivables - totalLoans;

  return {
    totalInvestments,
    totalLoans,
    totalProperties,
    totalStocks,
    totalMutualFunds,
    totalPPF,
    totalBankBalances,
    totalReceivables,
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

  const investmentBreakdown = investments.reduce((acc, inv) => {
    acc[inv.type] = (acc[inv.type] || 0) + inv.amount;
    return acc;
  }, {} as Record<string, number>);

  // Add stocks, mutual funds, and PPF to breakdown
  if (totalStocks > 0) {
    investmentBreakdown['stocks'] = (investmentBreakdown['stocks'] || 0) + totalStocks;
  }
  if (totalMutualFunds > 0) {
    investmentBreakdown['mutual-fund'] = (investmentBreakdown['mutual-fund'] || 0) + totalMutualFunds;
  }
  if (totalPPF > 0) {
    investmentBreakdown['provident-fund'] = (investmentBreakdown['provident-fund'] || 0) + totalPPF;
  }

  const loanBreakdown = loans.reduce((acc, loan) => {
    acc[loan.type] = (acc[loan.type] || 0) + loan.outstandingAmount;
    return acc;
  }, {} as Record<string, number>);

  // Show individual properties in the breakdown chart instead of grouping by type
  const propertyBreakdown = properties.reduce((acc, prop) => {
    // Only process properties with valid values
    const value = prop.currentValue || prop.purchasePrice || 0;
    if (value > 0 && prop.name) {
      // Use property name for individual breakdown
      acc[prop.name] = (acc[prop.name] || 0) + value;
    }
    return acc;
  }, {} as Record<string, number>);


  const investmentChartData = Object.entries(investmentBreakdown).map(
    ([name, value]) => ({
      name: name === 'provident-fund' ? 'Provident Fund' : name === 'mutual-fund' ? 'Mutual Fund' : name.charAt(0).toUpperCase() + name.slice(1),
      value,
    })
  );

  const loanChartData = Object.entries(loanBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  const propertyChartData = Object.entries(propertyBreakdown)
    .filter(([name, value]) => value > 0) // Only include types with values > 0
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), // Ensure first letter is capitalized
      value,
    }))
    .sort((a, b) => b.value - a.value); // Sort by value descending

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading portfolio analytics..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* First Row: Net Worth, Total Investments, Total Loans, Total Properties */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Net Worth - First Card */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">Net Worth</p>
              <p
                className={`text-sm font-bold mt-2 truncate ${
                  netWorth >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                ₹{netWorth.toLocaleString()}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-purple-600 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">
                Total Investments{investmentsCount > 0 && ` (${investmentsCount})`}
              </p>
              <p className="text-sm font-bold text-green-600 mt-2 truncate">
                ₹{totalInvestments.toLocaleString()}
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
                ₹{totalLoans.toLocaleString()}
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
                ₹{totalProperties.toLocaleString()}
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
                ₹{totalStocks.toLocaleString()}
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
                ₹{totalMutualFunds.toLocaleString()}
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
              <p className="text-sm font-bold text-orange-600 mt-2 truncate">
                ₹{totalPPF.toLocaleString()}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-orange-600 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600">
                Bank Balances{bankBalancesCount > 0 && ` (${bankBalancesCount})`}
              </p>
              <p className="text-sm font-bold text-indigo-600 mt-2 truncate">
                ₹{totalBankBalances.toLocaleString()}
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
                ₹{totalReceivables.toLocaleString()}
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
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
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
