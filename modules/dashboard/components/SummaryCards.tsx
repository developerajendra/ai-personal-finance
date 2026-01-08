"use client";

import { FinancialSummary } from "@/core/types";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Loader } from "@/shared/components/Loader";

interface SummaryCardsProps {
  summary: FinancialSummary;
  netWorth?: number;
  isLoadingNetWorth?: boolean;
}

export function SummaryCards({ summary, netWorth, isLoadingNetWorth }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Net Worth - First Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        {isLoadingNetWorth ? (
          <Loader text="Loading..." size="sm" />
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Net Worth</p>
              <p
                className={`text-2xl font-bold mt-2 ${
                  (netWorth ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ₹{(netWorth ?? 0).toLocaleString()}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-purple-600" />
          </div>
        )}
      </div>

      {/* Total Income */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Income</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              ₹{summary.totalIncome.toLocaleString()}
            </p>
          </div>
          <TrendingUp className="w-8 h-8 text-green-600" />
        </div>
      </div>

      {/* Total Expenses */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600 mt-2">
              ₹{summary.totalExpenses.toLocaleString()}
            </p>
          </div>
          <TrendingDown className="w-8 h-8 text-red-600" />
        </div>
      </div>

      {/* Net Balance */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Net Balance</p>
            <p
              className={`text-2xl font-bold mt-2 ${
                summary.netBalance >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              ₹{summary.netBalance.toLocaleString()}
            </p>
          </div>
          <Wallet className="w-8 h-8 text-blue-600" />
        </div>
      </div>
    </div>
  );
}

