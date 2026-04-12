"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  CalendarDays,
  ArrowRight,
  BarChart2,
  RefreshCcw,
  Zap,
  Info,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Sidebar } from "@/shared/components/Sidebar";
import { Transaction } from "@/core/types";
import { formatIndianNumber } from "@/core/services/currencyService";
import { AddIncomeModal } from "@/modules/income/components/AddIncomeModal";
import { InvestmentIncomePanel } from "@/modules/income/components/InvestmentIncomePanel";
import { IncomeDataGrid } from "@/modules/income/components/IncomeDataGrid";
import { INCOME_GROUPS, ALL_INCOME_SLUGS } from "@/modules/income/components/IncomeCategoryCombobox";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = "overview" | "earned" | "passive" | "returns" | "other" | "investment";
type FreqFilter = "all" | "monthly" | "yearly" | "one-time";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PPF_RATE = 7.1;

const TAB_GROUPS: Record<string, string[]> = {
  earned:   INCOME_GROUPS["Earned Income"].map((i) => i.slug),
  passive:  INCOME_GROUPS["Passive Income"].map((i) => i.slug),
  returns:  INCOME_GROUPS["Investment Returns"].map((i) => i.slug),
  other:    INCOME_GROUPS["Other Income"].map((i) => i.slug),
};

const PIE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: string) { return d.split("T")[0]; }
function monthKey(y: number, m: number) { return `${y}-${String(m).padStart(2, "0")}`; }
function monthLabel(y: number, m: number) { return `${MONTH_NAMES[m]} '${String(y).slice(2)}`; }
function formatLabel(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IncomePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  // Fetch all transactions
  const { data: allTxns = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      const res = await fetch("/api/transactions");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // Fetch portfolio for investment income
  const { data: portfolio } = useQuery<any>({
    queryKey: ["portfolio-snapshot"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio/snapshot");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // ── Computed investment income (from portfolio) ───────────────────────────
  const investmentIncomeSources = useMemo(() => {
    if (!portfolio) return { monthly: 0, annual: 0 };
    let monthly = 0;

    // FD + bonds
    (portfolio.investments || [])
      .filter((inv: any) => (inv.type === "fd" || inv.type === "bonds") && inv.status !== "closed" && inv.interestRate > 0)
      .forEach((inv: any) => { monthly += (inv.amount * inv.interestRate) / 100 / 12; });

    // PPF
    (portfolio.ppfAccounts || []).forEach((acc: any) => {
      monthly += ((acc.grandTotal || 0) * PPF_RATE) / 100 / 12;
    });

    // Bank FDs with interest
    (portfolio.bankBalances || [])
      .filter((bb: any) => !(bb.tags?.includes("receivable")) && bb.assetType === "fixed" && bb.interestRate > 0)
      .forEach((bb: any) => { monthly += (bb.balance * bb.interestRate) / 100 / 12; });

    return { monthly, annual: monthly * 12 };
  }, [portfolio]);

  // ── Credit transactions (manual income) ──────────────────────────────────
  const creditTxns = useMemo(() => allTxns.filter((tx) => tx.type === "credit"), [allTxns]);

  // Filter by income categories only (not all credits — skip transfers, etc.)
  const incomeTxns = useMemo(
    () => creditTxns.filter((tx) => ALL_INCOME_SLUGS.includes(tx.category)),
    [creditTxns]
  );

  // ── Current month window ─────────────────────────────────────────────────
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const currentMonthTxns = useMemo(
    () => incomeTxns.filter((tx) => {
      const d = new Date(tx.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }),
    [incomeTxns, currentYear, currentMonth]
  );

  const currentMonthManual = useMemo(
    () => currentMonthTxns.reduce((s, tx) => s + tx.amount, 0),
    [currentMonthTxns]
  );

  // ── Recurring totals ─────────────────────────────────────────────────────
  const monthlyRecurring = useMemo(
    () => incomeTxns.filter((tx) => tx.frequency === "monthly").reduce((s, tx) => s + tx.amount, 0),
    [incomeTxns]
  );
  const yearlyRecurring = useMemo(
    () => incomeTxns.filter((tx) => tx.frequency === "yearly").reduce((s, tx) => s + tx.amount, 0),
    [incomeTxns]
  );
  const yearlyPerMonth = yearlyRecurring / 12;

  // Total effective monthly (recurring + investment)
  const totalEffectiveMonthly = monthlyRecurring + yearlyPerMonth + investmentIncomeSources.monthly;
  const totalAnnualProjection = monthlyRecurring * 12 + yearlyRecurring + investmentIncomeSources.annual;

  // ── 12-month trend ───────────────────────────────────────────────────────
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { manual: number; investment: number; y: number; m: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      map[monthKey(d.getFullYear(), d.getMonth())] = {
        manual: 0, investment: investmentIncomeSources.monthly, y: d.getFullYear(), m: d.getMonth(),
      };
    }
    incomeTxns.forEach((tx) => {
      const d = new Date(tx.date);
      const key = monthKey(d.getFullYear(), d.getMonth());
      if (map[key]) map[key].manual += tx.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        month: monthLabel(v.y, v.m),
        manual: v.manual,
        investment: Math.round(v.investment),
        total: v.manual + v.investment,
      }));
  }, [incomeTxns, investmentIncomeSources.monthly, currentYear, currentMonth]);

  // ── Source breakdown for donut ───────────────────────────────────────────
  const sourceBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    incomeTxns.forEach((tx) => {
      const label = formatLabel(tx.category);
      map[label] = (map[label] || 0) + tx.amount;
    });
    if (investmentIncomeSources.monthly > 0) {
      map["Investment Income"] = (map["Investment Income"] || 0) + investmentIncomeSources.monthly;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [incomeTxns, investmentIncomeSources.monthly]);

  // ── Tab-filtered transactions ────────────────────────────────────────────
  const tabTxns = useMemo(() => {
    let txns = incomeTxns;
    if (activeTab !== "overview" && activeTab !== "investment") {
      const slugs = TAB_GROUPS[activeTab] || [];
      txns = txns.filter((tx) => slugs.includes(tx.category));
    }
    if (freqFilter !== "all") txns = txns.filter((tx) => tx.frequency === freqFilter);
    return txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [incomeTxns, activeTab, freqFilter]);

  const tabTotal = useMemo(() => tabTxns.reduce((s, tx) => s + tx.amount, 0), [tabTxns]);

  // ── Category group totals (for sidebar cards) ─────────────────────────────
  const groupTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(TAB_GROUPS).forEach(([tab, slugs]) => {
      totals[tab] = incomeTxns.filter((tx) => slugs.includes(tx.category)).reduce((s, tx) => s + tx.amount, 0);
    });
    return totals;
  }, [incomeTxns]);

  // ── UI helpers ────────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "overview", label: "Overview", icon: <BarChart2 className="w-4 h-4" /> },
    { id: "earned", label: "Earned", icon: <Wallet className="w-4 h-4" />, count: incomeTxns.filter(tx => TAB_GROUPS.earned.includes(tx.category)).length },
    { id: "passive", label: "Passive", icon: <TrendingUp className="w-4 h-4" />, count: incomeTxns.filter(tx => TAB_GROUPS.passive.includes(tx.category)).length },
    { id: "returns", label: "Returns", icon: <ArrowRight className="w-4 h-4" />, count: incomeTxns.filter(tx => TAB_GROUPS.returns.includes(tx.category)).length },
    { id: "other", label: "Other", icon: <Zap className="w-4 h-4" />, count: incomeTxns.filter(tx => TAB_GROUPS.other.includes(tx.category)).length },
    { id: "investment", label: "Portfolio Income", icon: <Landmark className="w-4 h-4" /> },
  ];

  function yFmt(v: number) {
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
    return `₹${v}`;
  }

  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-4 py-3 text-sm">
        <p className="font-semibold text-gray-700 mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold text-gray-800">₹{formatIndianNumber(p.value)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Income</h1>
              <p className="text-gray-500 mt-1">
                All income sources — salary, passive, investments &amp; more
              </p>
            </div>
            <AddIncomeModal onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["transactions"] });
              queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
            }} />
          </div>

          {/* ── Hero Summary Cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

            {/* Card 1 — Total effective monthly */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-2xl p-5 shadow-lg col-span-2 xl:col-span-1">
              <p className="text-xs font-semibold text-emerald-100 uppercase tracking-wide mb-2">
                Total Monthly Income
              </p>
              <p className="text-3xl font-bold">
                ₹{formatIndianNumber(Math.round(totalEffectiveMonthly))}
              </p>
              <p className="text-emerald-200 text-xs mt-1">Salary + recurring + investments</p>
              <div className="mt-4 pt-3 border-t border-emerald-500/40 space-y-1">
                <div className="flex justify-between text-xs text-emerald-100">
                  <span>Monthly recurring</span>
                  <span className="font-semibold text-white">₹{formatIndianNumber(monthlyRecurring)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-100">
                  <span>Yearly ÷ 12</span>
                  <span className="font-semibold text-white">₹{formatIndianNumber(Math.round(yearlyPerMonth))}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-100">
                  <span>Investment income</span>
                  <span className="font-semibold text-white">₹{formatIndianNumber(Math.round(investmentIncomeSources.monthly))}</span>
                </div>
              </div>
            </div>

            {/* Card 2 — Annual projection */}
            <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Annual Projection</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{formatIndianNumber(Math.round(totalAnnualProjection))}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Projected full-year income</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl">
                  <CalendarDays className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Monthly × 12</span>
                  <span className="font-semibold text-gray-700">₹{formatIndianNumber(monthlyRecurring * 12)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Yearly one-shot</span>
                  <span className="font-semibold text-gray-700">₹{formatIndianNumber(yearlyRecurring)}</span>
                </div>
              </div>
            </div>

            {/* Card 3 — Passive / investment */}
            <div className="bg-white border border-amber-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Portfolio Income</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{formatIndianNumber(Math.round(investmentIncomeSources.monthly))}/mo
                  </p>
                  <p className="text-xs text-gray-400 mt-1">FD + PPF + bonds interest</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl">
                  <Landmark className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Annual</span>
                  <span className="font-semibold text-gray-700">
                    ₹{formatIndianNumber(Math.round(investmentIncomeSources.annual))}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Auto-computed</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Live
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4 — This month */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {now.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{formatIndianNumber(currentMonthManual + Math.round(investmentIncomeSources.monthly))}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Recorded + portfolio this month</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <RefreshCcw className="w-5 h-5 text-gray-500" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Recorded</span>
                  <span className="font-semibold text-gray-700">₹{formatIndianNumber(currentMonthManual)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Portfolio</span>
                  <span className="font-semibold text-emerald-600">
                    ₹{formatIndianNumber(Math.round(investmentIncomeSources.monthly))}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* ── Tabs ────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === tab.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Overview Tab ─────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-6">

              {/* 12-month trend + source donut */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Trend chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-gray-800">Income Trend</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Last 12 months — manual entries + portfolio income
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={monthlyTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="manualGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={yFmt} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={55} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="manual" name="Earned / Other" stroke="#10b981" strokeWidth={2} fill="url(#manualGrad)" stackId="1" />
                      <Area type="monotone" dataKey="investment" name="Portfolio Income" stroke="#f59e0b" strokeWidth={2} fill="url(#investGrad)" stackId="1" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Source donut */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Income Sources</h3>
                  {sourceBreakdown.length > 0 ? (
                    <>
                      <div className="relative">
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie data={sourceBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={2} stroke="#fff">
                              {sourceBreakdown.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => [`₹${formatIndianNumber(v)}`, ""]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-1.5 mt-2">
                        {sourceBreakdown.slice(0, 6).map((item, i) => {
                          const total = sourceBreakdown.reduce((s, x) => s + x.value, 0);
                          return (
                            <div key={item.name} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="text-gray-600 truncate">{item.name}</span>
                              </div>
                              <span className="text-gray-500 font-medium ml-2">
                                {total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-center">
                      <p className="text-gray-400 text-sm">No income recorded yet</p>
                      <p className="text-gray-300 text-xs mt-1">Add income using the button above</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Income group cards */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-3">By Category</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {(["earned", "passive", "returns", "other"] as const).map((tab) => {
                    const labelMap = { earned: "Earned Income", passive: "Passive Income", returns: "Investment Returns", other: "Other Income" };
                    const iconMap = {
                      earned: <Wallet className="w-5 h-5 text-emerald-600" />,
                      passive: <TrendingUp className="w-5 h-5 text-indigo-600" />,
                      returns: <ArrowRight className="w-5 h-5 text-amber-600" />,
                      other: <Zap className="w-5 h-5 text-purple-600" />,
                    };
                    const colorMap = {
                      earned: "border-emerald-100 hover:border-emerald-300",
                      passive: "border-indigo-100 hover:border-indigo-300",
                      returns: "border-amber-100 hover:border-amber-300",
                      other: "border-purple-100 hover:border-purple-300",
                    };
                    const count = incomeTxns.filter(tx => TAB_GROUPS[tab].includes(tx.category)).length;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`bg-white border rounded-2xl p-4 text-left hover:shadow-md transition-all ${colorMap[tab]}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="p-2.5 bg-gray-50 rounded-xl">{iconMap[tab]}</div>
                          {count > 0 && (
                            <span className="text-xs text-gray-400">{count} entries</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-medium">{labelMap[tab]}</p>
                        <p className="text-xl font-bold text-gray-900 mt-1">
                          ₹{formatIndianNumber(groupTotals[tab] || 0)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recent income entries */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-800">Recent Income</h3>
                  <button onClick={() => setActiveTab("earned")} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                    View all <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <IncomeDataGrid
                  transactions={[...incomeTxns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)}
                  isLoading={isLoading}
                  emptyMessage="No income recorded yet. Click 'Add Income' to get started."
                />
              </div>
            </div>
          )}

          {/* ── Earned / Passive / Returns / Other Tabs ──────────────────── */}
          {(activeTab === "earned" || activeTab === "passive" || activeTab === "returns" || activeTab === "other") && (
            <div className="space-y-5">

              {/* Frequency filter + total */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    Total: <span className="font-bold text-gray-900">₹{formatIndianNumber(tabTotal)}</span>
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-sm text-gray-500">{tabTxns.length} records</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                  {(["all", "monthly", "yearly", "one-time"] as FreqFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFreqFilter(f)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                        freqFilter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-category breakdown pills */}
              <div className="flex flex-wrap gap-2">
                {(INCOME_GROUPS[{
                  earned: "Earned Income",
                  passive: "Passive Income",
                  returns: "Investment Returns",
                  other: "Other Income",
                }[activeTab as keyof typeof TAB_GROUPS]] || []).map((item) => {
                  const count = tabTxns.filter((tx) => tx.category === item.slug).length;
                  const total = tabTxns.filter((tx) => tx.category === item.slug).reduce((s, tx) => s + tx.amount, 0);
                  return (
                    <div
                      key={item.slug}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
                        count > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-100 text-gray-400"
                      }`}
                    >
                      <span>{item.label}</span>
                      {count > 0 && <span className="font-bold">₹{formatIndianNumber(total)}</span>}
                    </div>
                  );
                })}
              </div>

              {/* Data grid */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <IncomeDataGrid
                  transactions={tabTxns}
                  isLoading={isLoading}
                  emptyMessage={`No ${activeTab} income recorded. Use 'Add Income' to add entries.`}
                />
              </div>
            </div>
          )}

          {/* ── Investment / Portfolio Income Tab ────────────────────────── */}
          {activeTab === "investment" && (
            <div className="space-y-5">
              {/* Info banner */}
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Auto-computed from your portfolio</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    These figures are calculated from FD interest rates, PPF corpus, and bond yields in your portfolio.
                    To update, edit the investment in the Portfolio section.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <InvestmentIncomePanel />
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
