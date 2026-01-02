"use client";

import { FinancialSummary } from "@/core/types";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface SummaryCardsProps {
  summary: FinancialSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

