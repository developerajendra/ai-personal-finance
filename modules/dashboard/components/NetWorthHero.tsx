"use client";

import { formatIndianNumber } from "@/core/services/currencyService";
import { TrendingUp, TrendingDown, Wallet, Lock, Droplets } from "lucide-react";

interface NetWorthHeroProps {
  netWorth: number;
  totalFixedAssets: number;
  totalLiquidAssets: number;
  totalLoans: number;
  totalAssets: number;
  isLoading: boolean;
}

export function NetWorthHero({
  netWorth,
  totalFixedAssets,
  totalLiquidAssets,
  totalLoans,
  totalAssets,
  isLoading,
}: NetWorthHeroProps) {
  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 rounded-2xl p-8 shadow-2xl animate-pulse">
        <div className="h-4 bg-white/20 rounded w-24 mb-4" />
        <div className="h-12 bg-white/20 rounded w-56 mb-6" />
        <div className="flex gap-4">
          <div className="h-8 bg-white/20 rounded w-36" />
          <div className="h-8 bg-white/20 rounded w-36" />
          <div className="h-8 bg-white/20 rounded w-36" />
        </div>
      </div>
    );
  }

  const fixedPct = totalAssets > 0 ? (totalFixedAssets / totalAssets) * 100 : 0;
  const liquidPct = totalAssets > 0 ? (totalLiquidAssets / totalAssets) * 100 : 0;
  const isPositive = netWorth >= 0;

  return (
    <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 rounded-2xl p-8 shadow-2xl text-white">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left: Net Worth */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-white/70" />
            <p className="text-sm font-medium text-white/70 uppercase tracking-widest">
              Net Worth
            </p>
          </div>
          <p
            className={`text-5xl font-bold tracking-tight ${
              isPositive ? "text-white" : "text-red-300"
            }`}
          >
            ₹{formatIndianNumber(Math.abs(netWorth))}
            {!isPositive && (
              <span className="text-2xl text-red-300 ml-2">(negative)</span>
            )}
          </p>
          <p className="text-white/60 text-sm mt-2">
            Total Assets: ₹{formatIndianNumber(totalAssets)}
          </p>
        </div>

        {/* Right: Breakdown pills */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Fixed Assets */}
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl px-5 py-4 min-w-[160px]">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-blue-200" />
              <span className="text-xs text-white/60 uppercase tracking-wide">Fixed</span>
            </div>
            <p className="text-lg font-bold text-white">
              ₹{formatIndianNumber(totalFixedAssets)}
            </p>
            <div className="mt-2 h-1 bg-white/20 rounded-full">
              <div
                className="h-1 bg-blue-300 rounded-full"
                style={{ width: `${Math.min(fixedPct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-white/50 mt-1">{fixedPct.toFixed(0)}% of assets</p>
          </div>

          {/* Liquid Assets */}
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl px-5 py-4 min-w-[160px]">
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="w-4 h-4 text-emerald-200" />
              <span className="text-xs text-white/60 uppercase tracking-wide">Liquid</span>
            </div>
            <p className="text-lg font-bold text-white">
              ₹{formatIndianNumber(totalLiquidAssets)}
            </p>
            <div className="mt-2 h-1 bg-white/20 rounded-full">
              <div
                className="h-1 bg-emerald-300 rounded-full"
                style={{ width: `${Math.min(liquidPct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-white/50 mt-1">{liquidPct.toFixed(0)}% of assets</p>
          </div>

          {/* Loans */}
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl px-5 py-4 min-w-[160px]">
            <div className="flex items-center gap-2 mb-1">
              {totalLoans > 0 ? (
                <TrendingDown className="w-4 h-4 text-red-300" />
              ) : (
                <TrendingUp className="w-4 h-4 text-emerald-300" />
              )}
              <span className="text-xs text-white/60 uppercase tracking-wide">Loans</span>
            </div>
            <p className={`text-lg font-bold ${totalLoans > 0 ? "text-red-300" : "text-emerald-300"}`}>
              ₹{formatIndianNumber(totalLoans)}
            </p>
            <div className="mt-2 h-1 bg-white/20 rounded-full">
              <div
                className="h-1 bg-red-400 rounded-full"
                style={{ width: totalAssets > 0 ? `${Math.min((totalLoans / totalAssets) * 100, 100)}%` : "0%" }}
              />
            </div>
            <p className="text-xs text-white/50 mt-1">
              {totalAssets > 0 ? ((totalLoans / totalAssets) * 100).toFixed(0) : 0}% of assets
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
