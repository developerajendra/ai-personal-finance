"use client";

import { useEffect, useRef } from "react";
import { X, Lock, Droplets, CreditCard, TrendingUp } from "lucide-react";
import { formatIndianNumber } from "@/core/services/currencyService";
import { AssetItem } from "@/shared/hooks/useDashboardData";

type ModalType = "fixed" | "liquid" | "loans" | null;

interface LoanItem {
  id: string;
  name: string;
  type: string;
  outstandingAmount: number;
  interestRate: number;
  emiAmount: number;
  status: string;
}

interface AssetBreakdownModalProps {
  open: ModalType;
  onClose: () => void;
  fixedAssetItems: AssetItem[];
  liquidAssetItems: AssetItem[];
  loans: LoanItem[];
  totalFixedAssets: number;
  totalLiquidAssets: number;
  totalLoans: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Fixed Deposit": "bg-blue-50 text-blue-700",
  "Bonds": "bg-indigo-50 text-indigo-700",
  "Bank FD": "bg-cyan-50 text-cyan-700",
  "Investment": "bg-violet-50 text-violet-700",
  "House": "bg-amber-50 text-amber-700",
  "Apartment": "bg-amber-50 text-amber-700",
  "Plot": "bg-orange-50 text-orange-700",
  "Land": "bg-orange-50 text-orange-700",
  "Commercial": "bg-yellow-50 text-yellow-700",
  "Stocks": "bg-emerald-50 text-emerald-700",
  "Mutual Fund": "bg-purple-50 text-purple-700",
  "PPF": "bg-green-50 text-green-700",
  "Bank Balance": "bg-sky-50 text-sky-700",
  "Receivable": "bg-teal-50 text-teal-700",
};

function categoryBadge(category: string) {
  return CATEGORY_COLORS[category] || "bg-gray-100 text-gray-600";
}

function formatMaturity(date?: string) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  "home-loan": "Home Loan",
  "car-loan": "Car Loan",
  "personal-loan": "Personal Loan",
  "education-loan": "Education Loan",
  other: "Other",
};

export function AssetBreakdownModal({
  open,
  onClose,
  fixedAssetItems,
  liquidAssetItems,
  loans,
  totalFixedAssets,
  totalLiquidAssets,
  totalLoans,
}: AssetBreakdownModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent scroll on body
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const isFixed = open === "fixed";
  const isLiquid = open === "liquid";
  const isLoans = open === "loans";

  const items = isFixed ? fixedAssetItems : isLiquid ? liquidAssetItems : [];
  const totalValue = isFixed ? totalFixedAssets : isLiquid ? totalLiquidAssets : totalLoans;

  const title = isFixed ? "Fixed Assets" : isLiquid ? "Liquid Assets" : "Active Loans";
  const subtitle = isFixed
    ? "Long-term, non-liquid holdings"
    : isLiquid
    ? "Easily accessible assets"
    : "Outstanding loan obligations";

  const Icon = isFixed ? Lock : isLiquid ? Droplets : CreditCard;
  const iconColor = isFixed
    ? "text-blue-400"
    : isLiquid
    ? "text-emerald-400"
    : "text-red-400";
  const headerGradient = isFixed
    ? "from-blue-600 to-indigo-600"
    : isLiquid
    ? "from-emerald-600 to-teal-600"
    : "from-red-500 to-rose-600";

  const hasMonthlyIncome = items.some((i) => (i.monthlyIncome || 0) > 0);
  const totalMonthlyIncome = items.reduce((s, i) => s + (i.monthlyIncome || 0), 0);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`bg-gradient-to-r ${headerGradient} p-6 text-white flex-shrink-0`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-5 h-5 ${iconColor} brightness-200`} />
                <h2 className="text-xl font-bold">{title}</h2>
              </div>
              <p className="text-white/60 text-sm">{subtitle}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Summary row */}
          <div className="mt-4 flex flex-wrap gap-4">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wide">Total Value</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                ₹{formatIndianNumber(totalValue)}
              </p>
            </div>
            {!isLoans && (
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wide">Holdings</p>
                <p className="text-2xl font-bold text-white mt-0.5">{items.length}</p>
              </div>
            )}
            {hasMonthlyIncome && totalMonthlyIncome > 0 && (
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wide">Monthly Interest</p>
                <p className="text-2xl font-bold text-white mt-0.5">
                  ₹{formatIndianNumber(totalMonthlyIncome)}/mo
                </p>
              </div>
            )}
            {isLoans && (
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wide">Active Loans</p>
                <p className="text-2xl font-bold text-white mt-0.5">{loans.length}</p>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* Asset items */}
          {!isLoans && (
            <>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <TrendingUp className="w-10 h-10 text-gray-200 mb-3" />
                  <p className="text-gray-400 text-sm">No {isFixed ? "fixed" : "liquid"} assets found</p>
                  <p className="text-gray-300 text-xs mt-1">
                    Add investments in the portfolio section
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      {/* Category badge */}
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${categoryBadge(
                          item.category
                        )}`}
                      >
                        {item.category}
                      </span>

                      {/* Name + detail */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {item.interestRate && (
                            <span className="text-xs text-gray-400">{item.interestRate}% p.a.</span>
                          )}
                          {item.maturityDate && (
                            <span className="text-xs text-gray-400">
                              Matures: {formatMaturity(item.maturityDate)}
                            </span>
                          )}
                          {item.detail && (
                            <span className="text-xs text-gray-400 truncate">{item.detail}</span>
                          )}
                        </div>
                      </div>

                      {/* Value + monthly income */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">
                          ₹{formatIndianNumber(item.value)}
                        </p>
                        {item.monthlyIncome && item.monthlyIncome > 0 && (
                          <p className="text-xs text-emerald-600 mt-0.5">
                            +₹{formatIndianNumber(item.monthlyIncome)}/mo
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Loan items */}
          {isLoans && (
            <>
              {loans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-gray-400 text-sm">No active loans — debt free!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {loans.map((loan) => (
                    <div
                      key={loan.id}
                      className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 flex-shrink-0">
                        {LOAN_TYPE_LABELS[loan.type] || loan.type}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{loan.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {loan.interestRate}% p.a. · EMI ₹{formatIndianNumber(loan.emiAmount)}/mo
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-red-600">
                          ₹{formatIndianNumber(loan.outstandingAmount)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">outstanding</p>
                      </div>
                    </div>
                  ))}

                  {/* Total EMI footer */}
                  <div className="mt-3 p-4 bg-red-50 rounded-xl border border-red-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-red-600 uppercase tracking-wide font-medium">
                        Total Monthly EMI
                      </p>
                      <p className="text-xs text-red-400 mt-0.5">All active loans combined</p>
                    </div>
                    <p className="text-xl font-bold text-red-700">
                      ₹{formatIndianNumber(loans.reduce((s, l) => s + (l.emiAmount || 0), 0))}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
