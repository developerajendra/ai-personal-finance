"use client";

import { FinancialSummary } from "@/shared/types";
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
      <div className="panel p-6">
        {isLoadingNetWorth ? (
          <Loader text="Loading..." size="sm" />
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Net Worth</p>
              <p
                className={`text-2xl font-bold mt-2 ${
                  (netWorth ?? 0) >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                ₹{(netWorth ?? 0).toLocaleString()}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-accent-700" />
          </div>
        )}
      </div>

      {/* Total Income */}
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Total Income</p>
            <p className="text-2xl font-bold text-gain mt-2">
              ₹{summary.totalIncome.toLocaleString()}
            </p>
          </div>
          <TrendingUp className="w-8 h-8 text-gain" />
        </div>
      </div>

      {/* Total Expenses */}
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Total Expenses</p>
            <p className="text-2xl font-bold text-loss mt-2">
              ₹{summary.totalExpenses.toLocaleString()}
            </p>
          </div>
          <TrendingDown className="w-8 h-8 text-loss" />
        </div>
      </div>

      {/* Net Balance */}
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Net Balance</p>
            <p
              className={`text-2xl font-bold mt-2 ${
                summary.netBalance >= 0 ? "text-gain" : "text-loss"
              }`}
            >
              ₹{summary.netBalance.toLocaleString()}
            </p>
          </div>
          <Wallet className="w-8 h-8 text-accent-700" />
        </div>
      </div>
    </div>
  );
}

