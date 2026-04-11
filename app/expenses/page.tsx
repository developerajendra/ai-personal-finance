"use client";

import { useState, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/shared/components/Sidebar";
import { DataGrid } from "@/modules/admin-panel/components/DataGrid";
import { AddExpenseModal } from "@/modules/expenses/components/AddExpenseModal";
import { useFinancialData } from "@/shared/hooks/useFinancialData";
import { EXPENSE_GROUPS } from "@/core/config/constants";
import { Transaction } from "@/core/types";
import {
  Download,
  Upload,
  CalendarDays,
  TrendingUp,
  X,
} from "lucide-react";

type FrequencyFilter = "all" | "daily" | "monthly" | "yearly";

const GROUP_ICONS: Record<string, string> = {
  "Household Bills":    "🏠",
  "Loans & EMI":        "💳",
  "Healthcare":         "❤️",
  "Household Services": "🧹",
  "Transport":          "🚗",
  "Food & Dining":      "🍽️",
  "Shopping":           "🛍️",
  "Subscriptions":      "📱",
  "Education":          "📚",
  "Other":              "📦",
};

// Returns the current month's date range as YYYY-MM-DD strings (timezone-safe)
function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(lastDay).padStart(2, "0")}` };
}

// Normalize any date string to YYYY-MM-DD for safe string comparison
function toDateStr(d: string): string {
  return d.split("T")[0];
}

export default function ExpensesPage() {
  const { transactions, isLoading } = useFinancialData();
  const queryClient = useQueryClient();
  const importRef = useRef<HTMLInputElement>(null);

  const [freqFilter, setFreqFilter] = useState<FrequencyFilter>("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  // All debit transactions
  const allExpenses = useMemo(
    () => transactions.filter((tx) => tx.type === "debit"),
    [transactions]
  );

  // Summary card totals — purely frequency-based, never date-filtered
  const monthlyRecurringTotal = useMemo(
    () => allExpenses.filter((tx) => tx.frequency === "monthly").reduce((s, tx) => s + tx.amount, 0),
    [allExpenses]
  );
  const monthlyRecurringCount = useMemo(
    () => allExpenses.filter((tx) => tx.frequency === "monthly").length,
    [allExpenses]
  );
  const yearlyRecurringTotal = useMemo(
    () => allExpenses.filter((tx) => tx.frequency === "yearly").reduce((s, tx) => s + tx.amount, 0),
    [allExpenses]
  );
  const yearlyRecurringCount = useMemo(
    () => allExpenses.filter((tx) => tx.frequency === "yearly").length,
    [allExpenses]
  );
  // Yearly ÷ 12 = monthly equivalent of yearly expenses
  const yearlyPerMonth = Math.round(yearlyRecurringTotal / 12);
  // Total effective monthly cost (monthly recurring + yearly amortised monthly)
  const totalMonthlyEffective = monthlyRecurringTotal + yearlyPerMonth;
  // Estimated yearly cost (monthly × 12 + yearly one-shot)
  const estimatedYearlyTotal = monthlyRecurringTotal * 12 + yearlyRecurringTotal;

  // Frequency-filtered expenses (what the tabs control)
  const freqExpenses = useMemo(() => {
    if (freqFilter === "all") return allExpenses;
    return allExpenses.filter((tx) => tx.frequency === freqFilter);
  }, [allExpenses, freqFilter]);

  // Group-filtered for the table
  const displayTransactions: Transaction[] = useMemo(() => {
    if (!selectedGroup) return freqExpenses;
    const slugs = EXPENSE_GROUPS[selectedGroup] ?? [];
    return freqExpenses.filter((tx) => slugs.includes(tx.category));
  }, [freqExpenses, selectedGroup]);

  // Group totals (frequency-scoped)
  const groupTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const [name, slugs] of Object.entries(EXPENSE_GROUPS)) {
      totals[name] = freqExpenses.filter((tx) => slugs.includes(tx.category)).reduce((s, tx) => s + tx.amount, 0);
    }
    return totals;
  }, [freqExpenses]);

  const freqTotal = useMemo(() => freqExpenses.reduce((s, tx) => s + tx.amount, 0), [freqExpenses]);

  // --- Export ---
  async function handleExport() {
    const params = new URLSearchParams();
    if (selectedGroup) params.set("group", selectedGroup);
    if (freqFilter !== "all") params.set("frequency", freqFilter);
    const res = await fetch(`/api/expenses/export?${params.toString()}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${freqFilter}${selectedGroup ? `-${selectedGroup.replace(/\s+/g, "-").toLowerCase()}` : ""}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Import ---
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportMsg("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/expenses/import", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        setImportMsg(`✓ Imported ${json.count} expense${json.count !== 1 ? "s" : ""} successfully.`);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      } else {
        setImportMsg(`✗ ${json.error || "Import failed."}`);
      }
    } catch {
      setImportMsg("✗ Network error during import.");
    } finally {
      setIsImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  const freqLabel = freqFilter === "all" ? "All" : freqFilter.charAt(0).toUpperCase() + freqFilter.slice(1);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
              <p className="text-gray-500 mt-1">Track and manage your spending</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Export */}
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 bg-white rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>

              {/* Import */}
              <label className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 bg-white rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                {isImporting ? "Importing..." : "Import Excel"}
                <input
                  ref={importRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportFile}
                  disabled={isImporting}
                />
              </label>

              {/* Add Expense popup */}
              <AddExpenseModal />
            </div>
          </div>

          {/* Import feedback */}
          {importMsg && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium ${importMsg.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              <span>{importMsg}</span>
              <button onClick={() => setImportMsg("")}><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Card 1 — Monthly recurring */}
            <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Monthly Expenses</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{monthlyRecurringTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Recurring every month</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl">
                  <CalendarDays className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{monthlyRecurringCount}</span> items
                </span>
              </div>
            </div>

            {/* Card 2 — Total effective monthly cost */}
            <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">Total Monthly Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{totalMonthlyEffective.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Monthly + Yearly ÷ 12</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Monthly</span>
                  <span className="font-semibold text-gray-700">₹{monthlyRecurringTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Yearly ÷ 12</span>
                  <span className="font-semibold text-gray-700">₹{yearlyPerMonth.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Card 3 — Yearly recurring */}
            <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">Annual Recurring</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{yearlyRecurringTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    ≈ <span className="font-semibold text-gray-600">₹{yearlyPerMonth.toLocaleString("en-IN")}</span>/month
                  </p>
                </div>
                <div className="p-3 bg-orange-50 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{yearlyRecurringCount}</span> items
                </span>
              </div>
            </div>

            {/* Card 4 — Estimated yearly total */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl p-5 shadow-sm text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-1">Annual Cost Projection</p>
                  <p className="text-2xl font-bold">
                    ₹{estimatedYearlyTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Full-year spend estimate</p>
                </div>
                <div className="p-3 bg-white/10 rounded-xl">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Monthly × 12</span>
                  <span className="font-semibold text-white">₹{(monthlyRecurringTotal * 12).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Yearly one-shot</span>
                  <span className="font-semibold text-white">₹{yearlyRecurringTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Filters: Group + Frequency */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Group dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 font-medium">Group:</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Groups</option>
                {Object.keys(EXPENSE_GROUPS).map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              {selectedGroup && (
                <button onClick={() => setSelectedGroup("")} className="text-xs text-blue-600 hover:underline">
                  Clear
                </button>
              )}
            </div>

            {/* Frequency tabs */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {(["all", "daily", "monthly", "yearly"] as FrequencyFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFreqFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                    freqFilter === f
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Group Overview Cards */}
          {!selectedGroup && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-700">
                  Spending by Category
                  {freqFilter !== "all" && (
                    <span className="ml-2 text-sm font-normal text-gray-400">
                      ({freqLabel} recurring)
                    </span>
                  )}
                </h2>
                <span className="text-sm text-gray-500">
                  Total:{" "}
                  <span className="font-bold text-gray-800">
                    ₹{freqTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Object.entries(EXPENSE_GROUPS).map(([groupName]) => {
                  const total = groupTotals[groupName] ?? 0;
                  return (
                    <button
                      key={groupName}
                      onClick={() => setSelectedGroup(groupName)}
                      className="flex-1 min-w-[80px] bg-white border border-gray-200 rounded-xl p-2 text-center hover:border-blue-400 hover:shadow-md transition-all group"
                    >
                      <div className="text-base mb-0.5">{GROUP_ICONS[groupName] ?? "📂"}</div>
                      <div className="text-[10px] text-gray-500 font-medium group-hover:text-blue-600 leading-tight">
                        {groupName}
                      </div>
                      <div className={`text-xs font-bold mt-0.5 ${total > 0 ? "text-gray-800" : "text-gray-400"}`}>
                        ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected group header */}
          {selectedGroup && (
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
              <span className="text-2xl">{GROUP_ICONS[selectedGroup] ?? "📂"}</span>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-800">{selectedGroup}</h2>
                <p className="text-sm text-gray-500">
                  ₹{(groupTotals[selectedGroup] ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  {freqFilter !== "all" ? ` · ${freqLabel} recurring` : ""}
                </p>
              </div>
              <button onClick={() => setSelectedGroup("")} className="text-sm text-blue-600 hover:underline font-medium">
                Show all
              </button>
            </div>
          )}

          {/* Transactions DataGrid */}
          <DataGrid
            transactions={displayTransactions}
            isLoading={isLoading}
            emptyMessage={
              selectedGroup
                ? `No ${freqFilter !== "all" ? freqLabel.toLowerCase() + " " : ""}expenses in ${selectedGroup}.`
                : freqFilter !== "all"
                ? `No ${freqLabel.toLowerCase()} recurring expenses found.`
                : "No expenses found. Add one using the button above."
            }
          />

        </div>
      </main>
    </div>
  );
}
