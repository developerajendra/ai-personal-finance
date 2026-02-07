'use client';

import { useQuery } from '@tanstack/react-query';
import { Loan } from '@/core/types';
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
import { CreditCard, TrendingDown, Calendar, DollarSign, Percent, Clock } from 'lucide-react';
import { Loader } from '@/shared/components/Loader';

const COLORS = ['#FF6B6B', '#FF8E53', '#FF6B9D', '#C44569', '#F8B500', '#4ECDC4'];

export function LoansDetailView() {
  const { data: loans = [], isLoading } = useQuery<Loan[]>({
    queryKey: ['loans', 'published'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/loans?isPublished=true');
      if (!response.ok) throw new Error('Failed to fetch loans');
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading loans data..." size="lg" />
      </div>
    );
  }

  const totalOutstanding = loans.reduce((sum, loan) => sum + loan.outstandingAmount, 0);
  const totalPrincipal = loans.reduce((sum, loan) => sum + loan.principalAmount, 0);
  const totalEMI = loans.reduce((sum, loan) => sum + loan.emiAmount, 0);
  const activeLoans = loans.filter((loan) => loan.status === 'active').length;
  const totalPaid = totalPrincipal - totalOutstanding;

  const loanTypeBreakdown = loans.reduce((acc, loan) => {
    const typeName = loan.type.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    acc[typeName] = (acc[typeName] || 0) + loan.outstandingAmount;
    return acc;
  }, {} as Record<string, number>);

  const loanChartData = Object.entries(loanTypeBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  const emiComparison = loans.map((loan) => ({
    name: loan.name.length > 15 ? loan.name.substring(0, 15) + '...' : loan.name,
    emi: loan.emiAmount,
    outstanding: loan.outstandingAmount,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Outstanding</p>
              <p className="text-2xl font-bold text-red-600 mt-2">
                ₹{totalOutstanding.toLocaleString()}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Principal</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">
                ₹{totalPrincipal.toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total EMI/Month</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                ₹{totalEMI.toLocaleString()}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Loans</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">
                {activeLoans}
              </p>
            </div>
            <CreditCard className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loanChartData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Loan Type Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={loanChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value">
                  {loanChartData.map((entry, index) => (
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

        {emiComparison.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">EMI vs Outstanding Amount</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={emiComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="emi" fill="#4ECDC4" name="EMI Amount" />
                <Bar dataKey="outstanding" fill="#FF6B6B" name="Outstanding" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {loans.length === 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center text-gray-500">
          <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No loans data available. Add loans in the Portfolio section.</p>
        </div>
      )}
    </div>
  );
}

