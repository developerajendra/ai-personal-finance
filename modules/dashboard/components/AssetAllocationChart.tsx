"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatIndianNumber } from "@/core/services/currencyService";

interface AllocationItem {
  name: string;
  value: number;
  color: string;
}

interface AssetAllocationChartProps {
  assetAllocation: AllocationItem[];
  totalAssets: number;
  isLoading: boolean;
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-white border border-gray-100 shadow-lg rounded-lg px-3 py-2 text-sm">
        <p className="font-semibold text-gray-800">{item.name}</p>
        <p className="text-gray-600">₹{formatIndianNumber(item.value)}</p>
        <p className="text-gray-400 text-xs">{(item.payload.percent * 100).toFixed(1)}%</p>
      </div>
    );
  }
  return null;
}

export function AssetAllocationChart({
  assetAllocation,
  totalAssets,
  isLoading,
}: AssetAllocationChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        <div className="h-48 bg-gray-100 rounded-full w-48 mx-auto" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 bg-gray-200 rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (assetAllocation.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
        <p className="text-gray-400 text-sm">No asset data available</p>
      </div>
    );
  }

  const dataWithPercent = assetAllocation.map((item) => ({
    ...item,
    percent: totalAssets > 0 ? item.value / totalAssets : 0,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-base font-semibold text-gray-800 mb-4">Asset Allocation</h3>

      {/* Donut chart with center label */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={dataWithPercent}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              dataKey="value"
              nameKey="name"
              strokeWidth={2}
              stroke="#fff"
            >
              {dataWithPercent.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-base font-bold text-gray-800 leading-tight">
            ₹{formatIndianNumber(totalAssets)}
          </p>
          <p className="text-xs text-gray-400">Total Assets</p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 space-y-1.5">
        {dataWithPercent.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-600 truncate">{item.name}</span>
            </div>
            <span className="text-gray-500 font-medium ml-2">
              {(item.percent * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
