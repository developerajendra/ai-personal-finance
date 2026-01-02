"use client";

import { Transaction, FinancialSummary } from "@/core/types";
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

interface FinancialChartsProps {
  transactions: Transaction[];
  summary: FinancialSummary;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export function FinancialCharts({
  transactions,
  summary,
}: FinancialChartsProps) {
  const categoryData = Object.entries(summary.categoryBreakdown).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  const monthlyData = transactions.reduce((acc, tx) => {
    const month = new Date(tx.date).toLocaleDateString("en-US", {
      month: "short",
    });
    if (!acc[month]) {
      acc[month] = { income: 0, expenses: 0 };
    }
    if (tx.type === "credit") {
      acc[month].income += tx.amount;
    } else {
      acc[month].expenses += tx.amount;
    }
    return acc;
  }, {} as Record<string, { income: number; expenses: number }>);

  const monthlyChartData = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    ...data,
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200 space-y-6">
      <h2 className="text-xl font-semibold">Financial Overview</h2>

      {categoryData.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Category Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
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
                {categoryData.map((entry, index) => (
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

      {monthlyChartData.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Monthly Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="income" fill="#00C49F" name="Income" />
              <Bar dataKey="expenses" fill="#FF8042" name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {categoryData.length === 0 && monthlyChartData.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <p>No data available. Upload financial data in the Admin Panel.</p>
        </div>
      )}
    </div>
  );
}

