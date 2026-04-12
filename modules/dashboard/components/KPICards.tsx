"use client";

import { TrendingUp, TrendingDown, Percent, ArrowRightLeft } from "lucide-react";
import { formatIndianNumber } from "@/core/services/currencyService";

interface KPICardsProps {
  currentMonthIncome: number;
  currentMonthExpenses: number;
  savingsRate: number;
  currentMonthCashFlow: number;
  prevMonthIncome: number;
  prevMonthExpenses: number;
  isLoading: boolean;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-7 bg-gray-200 rounded w-36 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-20" />
    </div>
  );
}

export function KPICards({
  currentMonthIncome,
  currentMonthExpenses,
  savingsRate,
  currentMonthCashFlow,
  prevMonthIncome,
  prevMonthExpenses,
  isLoading,
}: KPICardsProps) {
  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  if (isLoading) {
    return (
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">{monthLabel}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const incomeChange = pctChange(currentMonthIncome, prevMonthIncome);
  const expenseChange = pctChange(currentMonthExpenses, prevMonthExpenses);
  const cashFlowPositive = currentMonthCashFlow >= 0;

  const savingsColor =
    savingsRate >= 20 ? "text-emerald-600" : savingsRate >= 10 ? "text-amber-600" : "text-red-600";

  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">{monthLabel}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Income */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Income</p>
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ₹{formatIndianNumber(currentMonthIncome)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <TrendBadge value={incomeChange} />
            <span className="text-xs text-gray-400">vs last month</span>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Expenses</p>
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ₹{formatIndianNumber(currentMonthExpenses)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {/* For expenses: going up is bad, going down is good — invert the color */}
            {expenseChange !== null && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                  expenseChange <= 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {expenseChange <= 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <TrendingUp className="w-3 h-3" />
                )}
                {Math.abs(expenseChange).toFixed(1)}%
              </span>
            )}
            <span className="text-xs text-gray-400">vs last month</span>
          </div>
        </div>

        {/* Savings Rate */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Savings Rate</p>
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Percent className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <p className={`text-2xl font-bold mt-2 ${savingsColor}`}>
            {savingsRate.toFixed(1)}%
          </p>
          <div className="mt-2">
            <div className="h-1.5 bg-gray-100 rounded-full">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  savingsRate >= 20 ? "bg-emerald-500" : savingsRate >= 10 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(Math.max(savingsRate, 0), 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {savingsRate >= 20 ? "Excellent" : savingsRate >= 10 ? "Fair" : "Needs attention"}
            </p>
          </div>
        </div>

        {/* Cash Flow */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Cash Flow</p>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                cashFlowPositive ? "bg-emerald-50" : "bg-red-50"
              }`}
            >
              <ArrowRightLeft
                className={`w-4 h-4 ${cashFlowPositive ? "text-emerald-600" : "text-red-600"}`}
              />
            </div>
          </div>
          <p
            className={`text-2xl font-bold mt-2 ${
              cashFlowPositive ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {cashFlowPositive ? "+" : ""}₹{formatIndianNumber(Math.abs(currentMonthCashFlow))}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {cashFlowPositive ? "Surplus this month" : "Deficit this month"}
          </p>
        </div>
      </div>
    </div>
  );
}
