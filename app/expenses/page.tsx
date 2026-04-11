"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/shared/components/Sidebar";
import { DataGrid } from "@/modules/admin-panel/components/DataGrid";
import { CategoryCombobox } from "@/modules/expenses/components/CategoryCombobox";
import { useFinancialData } from "@/shared/hooks/useFinancialData";
import { EXPENSE_GROUPS } from "@/core/config/constants";
import { Transaction } from "@/core/types";

type Period = "daily" | "monthly" | "yearly";

function formatLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getDateRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  if (period === "daily") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 86400000 - 1);
    return { start, end };
  }
  if (period === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }
  // yearly
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  return { start, end };
}

const GROUP_ICONS: Record<string, string> = {
  "Household Bills": "🏠",
  "Loans & EMI": "💳",
  "Healthcare": "❤️",
  "Household Services": "🧹",
  "Transport": "🚗",
  "Food & Dining": "🍽️",
  "Shopping": "🛍️",
  "Subscriptions": "📱",
  "Education": "📚",
  "Other": "📦",
};

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  description: "",
  category: "",
  amount: "",
  type: "debit" as "debit" | "credit",
};

export default function ExpensesPage() {
  const { transactions, isLoading } = useFinancialData();
  const queryClient = useQueryClient();

  const [period, setPeriod] = useState<Period>("monthly");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Filter transactions by period
  const periodFiltered = useMemo(() => {
    const { start, end } = getDateRange(period);
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d >= start && d <= end;
    });
  }, [transactions, period]);

  // Further filter to only debit (expenses)
  const expenseTransactions = useMemo(
    () => periodFiltered.filter((tx) => tx.type === "debit"),
    [periodFiltered]
  );

  // Filter by selected group
  const groupFiltered: Transaction[] = useMemo(() => {
    if (!selectedGroup) return expenseTransactions;
    const groupSlugs = EXPENSE_GROUPS[selectedGroup] ?? [];
    return expenseTransactions.filter((tx) => groupSlugs.includes(tx.category));
  }, [expenseTransactions, selectedGroup]);

  // Group totals for overview cards
  const groupTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const [groupName, slugs] of Object.entries(EXPENSE_GROUPS)) {
      totals[groupName] = expenseTransactions
        .filter((tx) => slugs.includes(tx.category))
        .reduce((sum, tx) => sum + tx.amount, 0);
    }
    return totals;
  }, [expenseTransactions]);

  const totalExpenses = useMemo(
    () => expenseTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    [expenseTransactions]
  );

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!form.description.trim()) { setFormError("Description is required."); return; }
    if (!form.category) { setFormError("Please select a category."); return; }
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) { setFormError("Enter a valid amount."); return; }

    setIsSaving(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          description: form.description.trim(),
          category: form.category,
          amount,
          type: form.type,
          source: "excel",
          qualityGrade: "A",
        }),
      });

      if (res.ok) {
        setForm(emptyForm);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      } else {
        setFormError("Failed to save expense. Please try again.");
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">

          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
            <p className="text-gray-500 mt-1">Track and manage your spending</p>
          </div>

          {/* Add Expense Inline Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-4">Add Expense</h2>
            <form onSubmit={handleAddExpense}>
              <div className="flex flex-wrap items-end gap-3">
                {/* Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                  <label className="text-xs text-gray-500 font-medium">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="e.g. Monthly water bill"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">Category</label>
                  <CategoryCombobox
                    value={form.category}
                    onChange={(val) => setForm({ ...form, category: val })}
                    placeholder="Select category"
                  />
                </div>

                {/* Amount */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">Amount (₹)</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Type */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "debit" | "credit" })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? "Saving..." : "Add Expense"}
                </button>
              </div>

              {formError && (
                <p className="mt-2 text-sm text-red-600">{formError}</p>
              )}
            </form>
          </div>

          {/* Filters: Group + Period */}
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
                <button
                  onClick={() => setSelectedGroup("")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Period tabs */}
            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              {(["daily", "monthly", "yearly"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    period === p
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Group Overview Cards (shown only when no group filter) */}
          {!selectedGroup && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-700">
                  Spending by Group
                  <span className="ml-2 text-sm font-normal text-gray-400 capitalize">({period})</span>
                </h2>
                <span className="text-sm text-gray-500">
                  Total: <span className="font-semibold text-gray-800">₹{totalExpenses.toLocaleString()}</span>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {Object.entries(EXPENSE_GROUPS).map(([groupName]) => {
                  const total = groupTotals[groupName] ?? 0;
                  return (
                    <button
                      key={groupName}
                      onClick={() => setSelectedGroup(groupName)}
                      className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-400 hover:shadow-md transition-all group"
                    >
                      <div className="text-2xl mb-2">{GROUP_ICONS[groupName] ?? "📂"}</div>
                      <div className="text-xs text-gray-500 font-medium group-hover:text-blue-600 leading-tight">
                        {groupName}
                      </div>
                      <div className="text-base font-bold text-gray-800 mt-1">
                        ₹{total.toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected group header */}
          {selectedGroup && (
            <div className="flex items-center gap-2">
              <span className="text-xl">{GROUP_ICONS[selectedGroup] ?? "📂"}</span>
              <h2 className="text-lg font-semibold text-gray-800">{selectedGroup}</h2>
              <span className="text-sm text-gray-500">—</span>
              <span className="text-sm font-medium text-gray-700">
                ₹{(groupTotals[selectedGroup] ?? 0).toLocaleString()} this {period}
              </span>
            </div>
          )}

          {/* Transactions DataGrid */}
          <DataGrid
            transactions={groupFiltered}
            isLoading={isLoading}
            emptyMessage={
              selectedGroup
                ? `No ${selectedGroup.toLowerCase()} expenses found for this ${period}.`
                : `No expenses found for this ${period}.`
            }
          />
        </div>
      </main>
    </div>
  );
}
