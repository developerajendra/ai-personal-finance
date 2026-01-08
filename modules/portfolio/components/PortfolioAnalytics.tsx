'use client';

import { useQuery } from '@tanstack/react-query';
import { Investment, Loan, Property, PortfolioSummary } from '@/core/types';
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
import { TrendingUp, TrendingDown, Home, Wallet } from 'lucide-react';
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

  const isLoading =
    isLoadingInvestments || isLoadingLoans || isLoadingProperties || isLoadingStocks || isLoadingMutualFunds;

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
  const netWorth = totalInvestments + totalProperties + totalStocks + totalMutualFunds - totalLoans;

  return {
    totalInvestments,
    totalLoans,
    totalProperties,
    totalStocks,
    totalMutualFunds,
    netWorth,
    isLoading,
    investments,
    loans,
    properties,
    stocksData,
    mutualFundsData,
  };
}

function PortfolioAnalyticsContent() {
  const {
    totalInvestments,
    totalLoans,
    totalProperties,
    totalStocks,
    totalMutualFunds,
    isLoading,
    investments,
    loans,
    properties,
  } = usePortfolioData();

  const investmentBreakdown = investments.reduce((acc, inv) => {
    acc[inv.type] = (acc[inv.type] || 0) + inv.amount;
    return acc;
  }, {} as Record<string, number>);

  // Add stocks and mutual funds to breakdown
  if (totalStocks > 0) {
    investmentBreakdown['stocks'] = (investmentBreakdown['stocks'] || 0) + totalStocks;
  }
  if (totalMutualFunds > 0) {
    investmentBreakdown['mutual-fund'] = (investmentBreakdown['mutual-fund'] || 0) + totalMutualFunds;
  }

  const loanBreakdown = loans.reduce((acc, loan) => {
    acc[loan.type] = (acc[loan.type] || 0) + loan.outstandingAmount;
    return acc;
  }, {} as Record<string, number>);

  const propertyBreakdown = properties.reduce((acc, prop) => {
    acc[prop.type] =
      (acc[prop.type] || 0) + (prop.currentValue || prop.purchasePrice);
    return acc;
  }, {} as Record<string, number>);

  const investmentChartData = Object.entries(investmentBreakdown).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  const loanChartData = Object.entries(loanBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  const propertyChartData = Object.entries(propertyBreakdown).map(
    ([name, value]) => ({
      name,
      value,
    })
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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Investments</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                ₹{totalInvestments.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Stocks</p>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                ₹{totalStocks.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Mutual Funds</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                ₹{totalMutualFunds.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Loans</p>
              <p className="text-2xl font-bold text-red-600 mt-2">
                ₹{totalLoans.toLocaleString()}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Properties</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                ₹{totalProperties.toLocaleString()}
              </p>
            </div>
            <Home className="w-8 h-8 text-blue-600" />
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
                <Tooltip />
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
          </div>
        )}
    </div>
  );
}
