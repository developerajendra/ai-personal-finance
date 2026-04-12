"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ExternalLink, Lock, Droplets, TrendingUp, Landmark, Coins } from "lucide-react";
import { formatIndianNumber } from "@/core/services/currencyService";
import { Investment, BankBalance } from "@/core/types";
import { getCurrentInvestmentValue } from "@/core/utils/investmentValueCalculator";

interface PPFAccount {
  id: string;
  memberName?: string;
  establishmentName?: string;
  grandTotal?: number;
}

interface PortfolioSnapshot {
  investments: Investment[];
  bankBalances: BankBalance[];
  ppfAccounts: PPFAccount[];
  stocks: any[];
  mutualFunds: any[];
}

const PPF_RATE = 7.1;

interface IncomeRow {
  id: string;
  name: string;
  type: string;
  category: string;
  principal: number;
  currentValue: number;
  rate: number;
  monthlyIncome: number;
  annualIncome: number;
  maturityDate?: string;
  linkHref: string;
  isAutoComputed: boolean;
}

const CATEGORY_STYLES: Record<string, { icon: React.ReactNode; badge: string }> = {
  "FD": { icon: <Lock className="w-4 h-4 text-blue-500" />, badge: "bg-blue-50 text-blue-700" },
  "Bonds": { icon: <TrendingUp className="w-4 h-4 text-indigo-500" />, badge: "bg-indigo-50 text-indigo-700" },
  "PPF": { icon: <Landmark className="w-4 h-4 text-green-600" />, badge: "bg-green-50 text-green-700" },
  "Bank FD": { icon: <Lock className="w-4 h-4 text-cyan-500" />, badge: "bg-cyan-50 text-cyan-700" },
  "Receivable": { icon: <Coins className="w-4 h-4 text-teal-500" />, badge: "bg-teal-50 text-teal-700" },
  "Liquid Investment": { icon: <Droplets className="w-4 h-4 text-emerald-500" />, badge: "bg-emerald-50 text-emerald-700" },
};

function formatDate(d?: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function InvestmentIncomePanel() {
  const { data, isLoading } = useQuery<PortfolioSnapshot>({
    queryKey: ["portfolio-snapshot"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio/snapshot");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const rows = useMemo((): IncomeRow[] => {
    if (!data) return [];
    const result: IncomeRow[] = [];

    // FD and bond investments
    (data.investments || [])
      .filter((inv) => (inv.type === "fd" || inv.type === "bonds") && inv.status !== "closed" && (inv.interestRate || 0) > 0)
      .forEach((inv) => {
        const currentValue = getCurrentInvestmentValue(inv);
        const monthly = (inv.amount * (inv.interestRate || 0)) / 100 / 12;
        result.push({
          id: inv.id,
          name: inv.name,
          type: inv.type === "fd" ? "Fixed Deposit" : "Bonds",
          category: inv.type === "fd" ? "FD" : "Bonds",
          principal: inv.amount,
          currentValue,
          rate: inv.interestRate || 0,
          monthlyIncome: monthly,
          annualIncome: monthly * 12,
          maturityDate: inv.maturityDate || inv.endDate,
          linkHref: "/portfolio",
          isAutoComputed: true,
        });
      });

    // PPF accounts
    (data.ppfAccounts || []).forEach((acc) => {
      const corpus = acc.grandTotal || 0;
      if (corpus <= 0) return;
      const monthly = (corpus * PPF_RATE) / 100 / 12;
      result.push({
        id: acc.id,
        name: acc.memberName || acc.establishmentName || "PPF Account",
        type: "PPF",
        category: "PPF",
        principal: corpus,
        currentValue: corpus,
        rate: PPF_RATE,
        monthlyIncome: monthly,
        annualIncome: monthly * 12,
        linkHref: "/portfolio/provident-fund",
        isAutoComputed: true,
      });
    });

    // Fixed bank balances with interest
    (data.bankBalances || [])
      .filter((bb: any) => !(bb.tags?.includes("receivable")) && bb.assetType === "fixed" && (bb.interestRate || 0) > 0)
      .forEach((bb: any) => {
        const monthly = (bb.balance * bb.interestRate) / 100 / 12;
        result.push({
          id: bb.id,
          name: `${bb.bankName} — ${bb.accountType?.toUpperCase() || "FD"}`,
          type: "Bank FD",
          category: "Bank FD",
          principal: bb.balance,
          currentValue: bb.balance,
          rate: bb.interestRate,
          monthlyIncome: monthly,
          annualIncome: monthly * 12,
          linkHref: "/portfolio/bank-balances",
          isAutoComputed: true,
        });
      });

    // Receivables
    (data.bankBalances || [])
      .filter((bb: any) => bb.tags?.includes("receivable") && (bb.interestRate || 0) > 0)
      .forEach((bb: any) => {
        const monthly = ((bb.balance || 0) * bb.interestRate) / 100 / 12;
        result.push({
          id: bb.id,
          name: bb.bankName,
          type: "Receivable",
          category: "Receivable",
          principal: bb.balance || 0,
          currentValue: bb.balance || 0,
          rate: bb.interestRate,
          monthlyIncome: monthly,
          annualIncome: monthly * 12,
          maturityDate: bb.dueDate,
          linkHref: "/portfolio/bank-balances",
          isAutoComputed: true,
        });
      });

    return result.sort((a, b) => b.monthlyIncome - a.monthlyIncome);
  }, [data]);

  const totalMonthly = rows.reduce((s, r) => s + r.monthlyIncome, 0);
  const totalAnnual = totalMonthly * 12;

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Landmark className="w-10 h-10 text-gray-200 mb-3" />
        <p className="text-gray-500 text-sm font-medium">No investment income sources found</p>
        <p className="text-gray-400 text-xs mt-1">
          Add FDs, bonds or PPF with interest rates to see computed income
        </p>
        <Link
          href="/portfolio"
          className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
        >
          Go to Portfolio <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
        <div>
          <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold">
            Total Auto-Computed Income
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Derived from your portfolio — no manual entry needed
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-emerald-700">
            ₹{formatIndianNumber(totalMonthly)}/mo
          </p>
          <p className="text-xs text-emerald-600">₹{formatIndianNumber(totalAnnual)}/yr</p>
        </div>
      </div>

      {/* Rows */}
      {rows.map((row) => {
        const style = CATEGORY_STYLES[row.category] ?? {
          icon: <TrendingUp className="w-4 h-4 text-gray-400" />,
          badge: "bg-gray-100 text-gray-600",
        };
        return (
          <div
            key={row.id}
            className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-emerald-100 hover:bg-emerald-50/30 transition-colors"
          >
            {/* Icon */}
            <div className="w-9 h-9 flex items-center justify-center bg-gray-50 rounded-lg flex-shrink-0">
              {style.icon}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-800 truncate">{row.name}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${style.badge}`}>
                  {row.type}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-xs text-gray-400">
                  Principal: ₹{formatIndianNumber(row.principal)}
                </span>
                <span className="text-xs text-gray-400">{row.rate}% p.a.</span>
                {row.maturityDate && (
                  <span className="text-xs text-amber-600">
                    Matures: {formatDate(row.maturityDate)}
                  </span>
                )}
              </div>
            </div>

            {/* Income */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-emerald-700">
                +₹{formatIndianNumber(row.monthlyIncome)}/mo
              </p>
              <p className="text-xs text-gray-400">
                ₹{formatIndianNumber(row.annualIncome)}/yr
              </p>
            </div>

            {/* Link */}
            <Link
              href={row.linkHref}
              className="flex-shrink-0 ml-1 p-1.5 rounded-lg text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="View in portfolio"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
