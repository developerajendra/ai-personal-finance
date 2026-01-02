"use client";

import { useQuery } from "@tanstack/react-query";
import { Investment, Loan, Property, PortfolioSummary } from "@/core/types";
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
} from "recharts";
import { TrendingUp, TrendingDown, Home, Wallet } from "lucide-react";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export function PortfolioAnalytics() {
  const { data: investments = [] } = useQuery<Investment[]>({
    queryKey: ["investments"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/investments");
      if (!response.ok) throw new Error("Failed to fetch investments");
      return response.json();
    },
  });

  const { data: loans = [] } = useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/loans");
      if (!response.ok) throw new Error("Failed to fetch loans");
      return response.json();
    },
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/properties");
      if (!response.ok) throw new Error("Failed to fetch properties");
      return response.json();
    },
  });

  const totalInvestments = investments.reduce((sum, inv) => sum + inv.amount, 0);
  const totalLoans = loans.reduce((sum, loan) => sum + loan.outstandingAmount, 0);
  const totalProperties = properties.reduce(
    (sum, prop) => sum + (prop.currentValue || prop.purchasePrice),
    0
  );
  const netWorth = totalInvestments + totalProperties - totalLoans;

  const investmentBreakdown = investments.reduce((acc, inv) => {
    acc[inv.type] = (acc[inv.type] || 0) + inv.amount;
    return acc;
  }, {} as Record<string, number>);

  const loanBreakdown = loans.reduce((acc, loan) => {
    acc[loan.type] = (acc[loan.type] || 0) + loan.outstandingAmount;
    return acc;
  }, {} as Record<string, number>);

  const propertyBreakdown = properties.reduce((acc, prop) => {
    acc[prop.type] = (acc[prop.type] || 0) + (prop.currentValue || prop.purchasePrice);
    return acc;
  }, {} as Record<string, number>);

  const investmentChartData = Object.entries(investmentBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  const loanChartData = Object.entries(loanBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  const propertyChartData = Object.entries(propertyBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Net Worth</p>
              <p
                className={`text-2xl font-bold mt-2 ${
                  netWorth >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ₹{netWorth.toLocaleString()}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-purple-600" />
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
                  dataKey="value"
                >
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
                  dataKey="value"
                >
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
              No portfolio data available. Add investments, loans, and properties in
              the Admin Panel to see analytics.
            </p>
          </div>
        )}
    </div>
  );
}

