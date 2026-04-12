"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { formatIndianNumber } from "@/core/services/currencyService";
import { CHART_PALETTE } from "@/shared/constants/dashboardColors";

interface BreakdownItem {
  name: string;
  value: number;
}

interface InvestmentBreakdownChartProps {
  investmentBreakdown: BreakdownItem[];
  isLoading: boolean;
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 shadow-lg rounded-lg px-3 py-2 text-sm">
        <p className="font-semibold text-gray-700">{payload[0].payload.name}</p>
        <p className="text-gray-600">₹{formatIndianNumber(payload[0].value)}</p>
      </div>
    );
  }
  return null;
}

function xAxisFormatter(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
}

export function InvestmentBreakdownChart({
  investmentBreakdown,
  isLoading,
}: InvestmentBreakdownChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-40 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 bg-gray-100 rounded" style={{ width: `${100 - i * 15}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (investmentBreakdown.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center min-h-[280px]">
        <p className="text-gray-400 text-sm">No investment data available</p>
      </div>
    );
  }

  const chartHeight = Math.max(investmentBreakdown.length * 44 + 20, 200);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-800">Investment Breakdown</h3>
        <p className="text-xs text-gray-400 mt-0.5">By asset class</p>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={investmentBreakdown}
          layout="vertical"
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis
            type="number"
            tickFormatter={xAxisFormatter}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {investmentBreakdown.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
