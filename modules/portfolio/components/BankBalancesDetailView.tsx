'use client';

import { useQuery } from '@tanstack/react-query';
import { BankBalance } from '@/core/types';
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
import { Wallet, Building2, TrendingUp, CreditCard, Calendar } from 'lucide-react';
import { Loader } from '@/shared/components/Loader';

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

export function BankBalancesDetailView() {
  const { data: bankBalances = [], isLoading } = useQuery<BankBalance[]>({
    queryKey: ['bankBalances', 'published'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/bank-balances?isPublished=true');
      if (!response.ok) throw new Error('Failed to fetch bank balances');
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading bank balances data..." size="lg" />
      </div>
    );
  }

  const totalBalance = bankBalances.reduce((sum, balance) => sum + balance.balance, 0);
  const activeAccounts = bankBalances.filter((balance) => balance.status === 'active').length;
  const totalBanks = new Set(bankBalances.map((b) => b.bankName)).size;

  const bankBreakdown = bankBalances.reduce((acc, balance) => {
    acc[balance.bankName] = (acc[balance.bankName] || 0) + balance.balance;
    return acc;
  }, {} as Record<string, number>);

  const bankChartData = Object.entries(bankBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  const accountTypeBreakdown = bankBalances.reduce((acc, balance) => {
    const typeName = balance.accountType.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    acc[typeName] = (acc[typeName] || 0) + balance.balance;
    return acc;
  }, {} as Record<string, number>);

  const accountTypeChartData = Object.entries(accountTypeBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  const balanceComparison = bankBalances.map((balance) => ({
    name: balance.bankName.length > 15 ? balance.bankName.substring(0, 15) + '...' : balance.bankName,
    balance: balance.balance,
    accountType: balance.accountType,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Balance</p>
              <p className="text-2xl font-bold text-indigo-600 mt-2">
                ₹{totalBalance.toLocaleString()}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Accounts</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {bankBalances.length}
              </p>
            </div>
            <CreditCard className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Accounts</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {activeAccounts}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Banks</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                {totalBanks}
              </p>
            </div>
            <Building2 className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {bankChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Balance by Bank</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={bankChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value">
                  {bankChartData.map((entry, index) => (
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

        {accountTypeChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Balance by Account Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={accountTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Bar dataKey="value" fill="#6366F1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bank Balance Details Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Account Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bank Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Currency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bankBalances.map((balance) => (
                <tr key={balance.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      {balance.bankName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {balance.accountType.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {balance.accountNumber || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-semibold">
                    ₹{balance.balance.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {balance.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(balance.lastUpdated).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        balance.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : balance.status === 'closed'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      {balance.status.charAt(0).toUpperCase() + balance.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bankBalances.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No bank balances data available. Add bank accounts in the Portfolio section.</p>
          </div>
        )}
      </div>
    </div>
  );
}

