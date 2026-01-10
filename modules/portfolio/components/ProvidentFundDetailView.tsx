'use client';

import { useQuery } from '@tanstack/react-query';
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
import { Wallet, TrendingUp, DollarSign, FileText, Building2 } from 'lucide-react';
import { Loader } from '@/shared/components/Loader';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function ProvidentFundDetailView() {
  const { data: accounts = [], isLoading } = useQuery<PPFAccount[]>({
    queryKey: ['ppfAccounts'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/ppf-accounts');
      if (!response.ok) throw new Error('Failed to fetch PPF accounts');
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading PPF account data..." size="lg" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center border border-gray-200">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No PPF Accounts Found</h3>
        <p className="text-gray-600 mb-6">
          Upload PPF PDF files from the Data → Upload Files → PPF Upload tab to get started.
        </p>
        <a
          href="/data/upload"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Upload Page
        </a>
      </div>
    );
  }

  // Calculate totals
  const totalDepositEmployee = accounts.reduce((sum, acc) => sum + (acc.depositEmployeeShare || 0), 0);
  const totalDepositEmployer = accounts.reduce((sum, acc) => sum + (acc.depositEmployerShare || 0), 0);
  const totalWithdrawEmployee = accounts.reduce((sum, acc) => sum + (acc.withdrawEmployeeShare || 0), 0);
  const totalWithdrawEmployer = accounts.reduce((sum, acc) => sum + (acc.withdrawEmployerShare || 0), 0);
  const totalPension = accounts.reduce((sum, acc) => sum + (acc.pensionContribution || 0), 0);
  const totalGrandTotal = accounts.reduce((sum, acc) => sum + (acc.grandTotal || 0), 0);
  const totalAccounts = accounts.length;
  
  // Net balance (Deposits - Withdrawals)
  const netDepositEmployee = totalDepositEmployee - totalWithdrawEmployee;
  const netDepositEmployer = totalDepositEmployer - totalWithdrawEmployer;
  const netTotal = netDepositEmployee + netDepositEmployer + totalPension;

  // Establishment-wise breakdown
  const establishmentBreakdown = accounts.reduce((acc, account) => {
    const estName = account.establishmentName || 'Unknown';
    acc[estName] = (acc[estName] || 0) + (account.grandTotal || 0);
    return acc;
  }, {} as Record<string, number>);

  const establishmentChartData = Object.entries(establishmentBreakdown).map(([name, value]) => ({
    name: name.length > 20 ? name.substring(0, 20) + '...' : name,
    value,
  }));

  // Account comparison
  const accountComparison = accounts.map((acc) => ({
    name: acc.memberId || acc.id.substring(0, 10),
    depositEmployee: acc.depositEmployeeShare || 0,
    depositEmployer: acc.depositEmployerShare || 0,
    withdrawEmployee: acc.withdrawEmployeeShare || 0,
    withdrawEmployer: acc.withdrawEmployerShare || 0,
    pension: acc.pensionContribution || 0,
    grandTotal: acc.grandTotal || 0,
  }));

  // Deposit vs Withdraw comparison
  const depositWithdrawData = [
    {
      name: 'Employee Share',
      deposit: totalDepositEmployee,
      withdraw: totalWithdrawEmployee,
      net: netDepositEmployee,
    },
    {
      name: 'Employer Share',
      deposit: totalDepositEmployer,
      withdraw: totalWithdrawEmployer,
      net: netDepositEmployer,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Grand Total</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{totalGrandTotal.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Net Total</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{netTotal.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-500 mt-1">(Deposits - Withdrawals + Pension)</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Pension</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{totalPension.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{totalAccounts}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Deposit - Employee Share</p>
          <p className="text-xl font-bold text-blue-600">
            ₹{totalDepositEmployee.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Deposit - Employer Share</p>
          <p className="text-xl font-bold text-blue-600">
            ₹{totalDepositEmployer.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Withdraw - Employee Share</p>
          <p className="text-xl font-bold text-red-600">
            ₹{totalWithdrawEmployee.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Withdraw - Employer Share</p>
          <p className="text-xl font-bold text-red-600">
            ₹{totalWithdrawEmployer.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Establishment-wise Distribution */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Grand Total by Establishment</h3>
          {establishmentChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={establishmentChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {establishmentChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">No data available</p>
          )}
        </div>

        {/* Deposit vs Withdraw Comparison */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Deposit vs Withdraw</h3>
          {depositWithdrawData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={depositWithdrawData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                />
                <Legend />
                <Bar dataKey="deposit" fill="#10B981" name="Deposit" />
                <Bar dataKey="withdraw" fill="#EF4444" name="Withdraw" />
                <Bar dataKey="net" fill="#3B82F6" name="Net" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">No data available</p>
          )}
        </div>
      </div>

      {/* Account Comparison */}
      {accountComparison.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Account Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={accountComparison}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 10 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
              />
              <Legend />
              <Bar dataKey="depositEmployee" fill="#3B82F6" name="Deposit - Employee" />
              <Bar dataKey="depositEmployer" fill="#10B981" name="Deposit - Employer" />
              <Bar dataKey="withdrawEmployee" fill="#EF4444" name="Withdraw - Employee" />
              <Bar dataKey="withdrawEmployer" fill="#F59E0B" name="Withdraw - Employer" />
              <Bar dataKey="pension" fill="#8B5CF6" name="Pension" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Account Details Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Account Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Member ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Member Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Establishment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Deposit - Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Deposit - Employer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Withdraw - Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Withdraw - Employer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Pension
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Grand Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {account.memberId || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {account.memberName || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="max-w-xs truncate" title={account.establishmentName || ''}>
                      {account.establishmentName || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                    ₹{(account.depositEmployeeShare || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                    ₹{(account.depositEmployerShare || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                    ₹{(account.withdrawEmployeeShare || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                    ₹{(account.withdrawEmployerShare || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-purple-600">
                    ₹{(account.pensionContribution || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    ₹{(account.grandTotal || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
