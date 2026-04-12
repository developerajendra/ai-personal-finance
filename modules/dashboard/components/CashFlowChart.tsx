"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatIndianNumber } from "@/core/services/currencyService";
import { DASHBOARD_COLORS } from "@/shared/constants/dashboardColors";

interface MonthlyTrendItem {
  month: string;
  income: number;
  expenses: number;
  cashFlow: number;
}

interface CashFlowChartProps {
  monthlyTrend: MonthlyTrendItem[];
  isLoading: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 shadow-lg rounded-lg px-4 py-3 text-sm min-w-[180px]">
        <p className="font-semibold text-gray-700 mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="font-medium text-gray-800">
              {p.value >= 0 ? "" : "-"}₹{formatIndianNumber(Math.abs(p.value))}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function yAxisFormatter(value: number): string {
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
}

export function CashFlowChart({ monthlyTrend, isLoading }: CashFlowChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-56 mb-6" />
        <div className="h-64 bg-gray-100 rounded" />
      </div>
    );
  }

  const hasData = monthlyTrend.some((m) => m.income > 0 || m.expenses > 0);

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center min-h-[320px]">
        <p className="text-gray-400 text-sm">No transaction data for the last 12 months</p>
        <p className="text-gray-300 text-xs mt-1">Upload expenses to see cash flow trends</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-800">Cash Flow Trend</h3>
        <p className="text-xs text-gray-400 mt-0.5">Last 12 months — income, expenses & net cash flow</p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={monthlyTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={DASHBOARD_COLORS.income} stopOpacity={0.15} />
              <stop offset="95%" stopColor={DASHBOARD_COLORS.income} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={DASHBOARD_COLORS.expenses} stopOpacity={0.15} />
              <stop offset="95%" stopColor={DASHBOARD_COLORS.expenses} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={yAxisFormatter}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", color: "#64748b", paddingTop: "12px" }}
          />
          <Area
            type="monotone"
            dataKey="income"
            name="Income"
            stroke={DASHBOARD_COLORS.income}
            strokeWidth={2}
            fill="url(#incomeGradient)"
          />
          <Area
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke={DASHBOARD_COLORS.expenses}
            strokeWidth={2}
            fill="url(#expenseGradient)"
          />
          <Line
            type="monotone"
            dataKey="cashFlow"
            name="Net Cash Flow"
            stroke={DASHBOARD_COLORS.cashFlow}
            strokeWidth={2.5}
            dot={false}
            strokeDasharray="4 2"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
