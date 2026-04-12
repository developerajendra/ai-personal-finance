"use client";

import { formatIndianNumber } from "@/core/services/currencyService";
import { CheckCircle, AlertCircle, AlertTriangle, CreditCard } from "lucide-react";
import { Loan } from "@/core/types";

interface LoanHealth {
  totalEMI: number;
  debtToIncome: number;
  highestRateLoan: Loan | null;
  loans: Loan[];
}

interface LoanHealthWidgetProps {
  loanHealth: LoanHealth;
  isLoading: boolean;
}

function healthStatus(debtToIncome: number) {
  if (debtToIncome === 0) return { label: "No Debt", color: "text-emerald-600", bg: "bg-emerald-50", bar: "bg-emerald-500" };
  if (debtToIncome < 30) return { label: "Healthy", color: "text-emerald-600", bg: "bg-emerald-50", bar: "bg-emerald-500" };
  if (debtToIncome < 50) return { label: "Watch", color: "text-amber-600", bg: "bg-amber-50", bar: "bg-amber-500" };
  return { label: "High Risk", color: "text-red-600", bg: "bg-red-50", bar: "bg-red-500" };
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  "home-loan": "Home Loan",
  "car-loan": "Car Loan",
  "personal-loan": "Personal Loan",
  "education-loan": "Education Loan",
  other: "Other",
};

export function LoanHealthWidget({ loanHealth, isLoading }: LoanHealthWidgetProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-28 mb-4" />
        <div className="h-8 bg-gray-200 rounded w-40 mb-4" />
        <div className="h-2 bg-gray-100 rounded-full mb-6" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const { totalEMI, debtToIncome, loans } = loanHealth;
  const status = healthStatus(debtToIncome);
  const barWidth = Math.min(debtToIncome, 100);

  if (loans.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Loan Health</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
          <p className="font-semibold text-emerald-700">Debt Free!</p>
          <p className="text-xs text-gray-400 mt-1">No active loans</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800">Loan Health</h3>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.color} ${status.bg}`}>
          {status.label}
        </span>
      </div>

      {/* Total EMI */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Monthly EMI</p>
        <p className="text-2xl font-bold text-gray-900">₹{formatIndianNumber(totalEMI)}</p>
      </div>

      {/* Debt-to-income bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500">Debt-to-Income Ratio</p>
          <p className={`text-xs font-bold ${status.color}`}>
            {debtToIncome.toFixed(1)}%
          </p>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${status.bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">Recommended: below 30%</p>
      </div>

      {/* Loan list */}
      <div className="space-y-2">
        {loans.slice(0, 4).map((loan) => (
          <div
            key={loan.id}
            className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CreditCard className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{loan.name}</p>
                <p className="text-xs text-gray-400">
                  {LOAN_TYPE_LABELS[loan.type] || loan.type} · {loan.interestRate}%
                </p>
              </div>
            </div>
            <div className="text-right ml-2 flex-shrink-0">
              <p className="text-xs font-semibold text-red-600">
                ₹{formatIndianNumber(loan.outstandingAmount)}
              </p>
              <p className="text-xs text-gray-400">outstanding</p>
            </div>
          </div>
        ))}
        {loans.length > 4 && (
          <p className="text-xs text-gray-400 text-center pt-1">
            +{loans.length - 4} more loan{loans.length - 4 > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
