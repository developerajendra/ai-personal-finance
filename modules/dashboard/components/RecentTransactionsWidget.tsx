"use client";

import Link from "next/link";
import { ArrowUpCircle, ArrowDownCircle, ArrowRight } from "lucide-react";
import { Transaction } from "@/core/types";
import { formatIndianNumber } from "@/core/services/currencyService";

interface RecentTransactionsWidgetProps {
  transactions: Transaction[];
  isLoading: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  food: "bg-orange-50 text-orange-700",
  groceries: "bg-green-50 text-green-700",
  transport: "bg-blue-50 text-blue-700",
  utilities: "bg-cyan-50 text-cyan-700",
  healthcare: "bg-pink-50 text-pink-700",
  entertainment: "bg-purple-50 text-purple-700",
  education: "bg-indigo-50 text-indigo-700",
  salary: "bg-emerald-50 text-emerald-700",
  investment: "bg-violet-50 text-violet-700",
  shopping: "bg-yellow-50 text-yellow-700",
  rent: "bg-red-50 text-red-700",
};

function categoryStyle(category: string): string {
  const key = category?.toLowerCase() || "";
  return CATEGORY_COLORS[key] || "bg-gray-100 text-gray-600";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function RecentTransactionsWidget({
  transactions,
  isLoading,
}: RecentTransactionsWidgetProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="flex justify-between mb-5">
          <div className="h-4 bg-gray-200 rounded w-40" />
          <div className="h-4 bg-gray-100 rounded w-16" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 bg-gray-100 rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-gray-200 rounded w-48" />
                <div className="h-2 bg-gray-100 rounded w-24" />
              </div>
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-800">Recent Transactions</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-gray-400 text-sm">No transactions yet</p>
          <p className="text-gray-300 text-xs mt-1">Upload your expense data to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Recent Transactions</h3>
          <p className="text-xs text-gray-400 mt-0.5">Latest {transactions.length} transactions</p>
        </div>
        <Link
          href="/expenses"
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          View all
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-0.5">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {/* Icon */}
            <div className="flex-shrink-0">
              {tx.type === "credit" ? (
                <ArrowUpCircle className="w-7 h-7 text-emerald-500" />
              ) : (
                <ArrowDownCircle className="w-7 h-7 text-red-400" />
              )}
            </div>

            {/* Description + date */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400">{formatDate(tx.date)}</span>
                {tx.category && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${categoryStyle(tx.category)}`}>
                    {tx.category}
                  </span>
                )}
              </div>
            </div>

            {/* Amount */}
            <span
              className={`text-sm font-semibold flex-shrink-0 ${
                tx.type === "credit" ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {tx.type === "credit" ? "+" : "-"}₹{formatIndianNumber(tx.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
