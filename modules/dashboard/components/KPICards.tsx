"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Percent,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Landmark,
  PiggyBank,
  CalendarRange,
} from "lucide-react";
import { formatIndianNumber } from "@/core/services/currencyService";
import { InvestmentIncomeItem } from "@/shared/hooks/useDashboardData";

interface KPICardsProps {
  currentMonthIncome: number;
  currentMonthExpenses: number;
  savingsRate: number;
  /** Salary/other credits + estimated investment accrual (monthly) */
  totalMonthlyIncomeForSurplus: number;
  /** After monthly expenses: total income − expenses */
  monthlyNetSavings: number;
  prevMonthIncome: number;
  prevMonthExpenses: number;
  monthlyInvestmentIncome: number;
  investmentIncomeBreakdown: InvestmentIncomeItem[];
  /** Indian FY YTD from transaction ledger */
  fyYtd: {
    fyLabel: string;
    fyIncome: number;
    fyExpenses: number;
    fyNetSavings: number;
  };
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
        positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
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

function InvestmentIncomeCard({
  monthlyInvestmentIncome,
  investmentIncomeBreakdown,
}: {
  monthlyInvestmentIncome: number;
  investmentIncomeBreakdown: InvestmentIncomeItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const annualIncome = monthlyInvestmentIncome * 12;

  return (
    <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
          Investment Income
        </p>
        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
          <Landmark className="w-4 h-4 text-emerald-600" />
        </div>
      </div>

      <p className="text-2xl font-bold text-emerald-700 mt-2">
        ₹{formatIndianNumber(monthlyInvestmentIncome)}
        <span className="text-sm font-normal text-gray-400">/mo</span>
      </p>

      <p className="text-xs text-gray-400 mt-1">
        ₹{formatIndianNumber(annualIncome)}/yr projected
      </p>

      {investmentIncomeBreakdown.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-indigo-600 mt-3 hover:text-indigo-700 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide" : "Show"} breakdown
        </button>
      )}

      {expanded && (
        <div className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
          {investmentIncomeBreakdown.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="min-w-0">
                <span className="text-gray-600 truncate block">{item.source}</span>
                <span className="text-gray-400">{item.type} · {item.rate}% p.a.</span>
              </div>
              <span className="text-emerald-600 font-semibold ml-2 flex-shrink-0">
                ₹{formatIndianNumber(item.monthlyIncome)}/mo
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function KPICards({
  currentMonthIncome,
  currentMonthExpenses,
  savingsRate,
  totalMonthlyIncomeForSurplus,
  monthlyNetSavings,
  prevMonthIncome,
  prevMonthExpenses,
  monthlyInvestmentIncome,
  investmentIncomeBreakdown,
  fyYtd,
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
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 mt-8">
          Financial year (YTD)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="mt-4">
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const incomeChange = pctChange(currentMonthIncome, prevMonthIncome);
  const expenseChange = pctChange(currentMonthExpenses, prevMonthExpenses);
  const surplusPositive = monthlyNetSavings >= 0;
  const totalMonthlyIncome = totalMonthlyIncomeForSurplus;
  const { fyLabel, fyIncome, fyExpenses, fyNetSavings } = fyYtd;
  const fySurplusPositive = fyNetSavings >= 0;

  const savingsColor =
    savingsRate >= 20 ? "text-emerald-600" : savingsRate >= 10 ? "text-amber-600" : "text-red-600";

  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">{monthLabel}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Income card — transaction income + investment income breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:col-span-2 xl:col-span-1">
          <div className="flex items-start justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Income</p>
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>

          {/* Total income (txn + investment) */}
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ₹{formatIndianNumber(totalMonthlyIncome)}
          </p>

          {/* Transaction vs investment split */}
          {monthlyInvestmentIncome > 0 ? (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Salary / Other</span>
                <span className="text-gray-600 font-medium">
                  ₹{formatIndianNumber(currentMonthIncome)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-600">Investments</span>
                <span className="text-emerald-600 font-medium">
                  +₹{formatIndianNumber(monthlyInvestmentIncome)}/mo
                </span>
              </div>
            </div>
          ) : currentMonthIncome === 0 ? (
            <p className="text-xs text-amber-500 mt-2">
              No transactions this month — upload expenses to track income
            </p>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <TrendBadge value={incomeChange} />
              <span className="text-xs text-gray-400">vs last month</span>
            </div>
          )}
        </div>

        {/* Investment Income (standalone card) */}
        <InvestmentIncomeCard
          monthlyInvestmentIncome={monthlyInvestmentIncome}
          investmentIncomeBreakdown={investmentIncomeBreakdown}
        />

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
            {expenseChange !== null && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                  expenseChange <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
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

      </div>

      {/* Financial year to date (India: Apr–Mar) — ledger cash basis */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <CalendarRange className="w-4 h-4 text-gray-400" />
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            Financial year to date · {fyLabel}
          </p>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Income and expenses below are sums of recorded transactions from 1 Apr through today. Investment accrual is
          reflected in the monthly cards above, not duplicated here.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">FY income (YTD)</p>
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-700 mt-2">₹{formatIndianNumber(fyIncome)}</p>
            <p className="text-xs text-gray-400 mt-1">All credits in {fyLabel} to date</p>
          </div>

          <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">FY expenses (YTD)</p>
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-700 mt-2">₹{formatIndianNumber(fyExpenses)}</p>
            <p className="text-xs text-gray-400 mt-1">All debits in {fyLabel} to date</p>
          </div>

          <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">FY net savings (YTD)</p>
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                <PiggyBank className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            <p
              className={`text-2xl font-bold mt-2 ${
                fySurplusPositive ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {fySurplusPositive ? "+" : "−"}₹{formatIndianNumber(Math.abs(fyNetSavings))}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              FY income − FY expenses (cash / recorded activity)
            </p>
          </div>
        </div>
      </div>

      {/* Monthly surplus — full width row */}
      <div className="mt-4 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                surplusPositive ? "bg-emerald-50" : "bg-red-50"
              }`}
            >
              <ArrowRightLeft
                className={`w-4 h-4 ${surplusPositive ? "text-emerald-600" : "text-red-600"}`}
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Monthly surplus</p>
              <p className="text-xs text-gray-400">
                Total income (₹{formatIndianNumber(totalMonthlyIncome)}) − Monthly expenses (₹
                {formatIndianNumber(currentMonthExpenses)})
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Total income includes salary/other credits plus estimated investment yield (FD, PPF, etc.).
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p
              className={`text-2xl font-bold ${
                surplusPositive ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {surplusPositive ? "+" : "−"}₹{formatIndianNumber(Math.abs(monthlyNetSavings))}
            </p>
            <p className="text-xs text-gray-400">
              {surplusPositive ? "Surplus after this month’s expenses" : "Shortfall after this month’s expenses"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
