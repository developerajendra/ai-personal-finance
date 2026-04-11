"use client";

import { useFinancialData } from "@/shared/hooks/useFinancialData";
import { Transaction } from "@/core/types";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Edit2, Trash2, X, Check } from "lucide-react";
import { ButtonLoader, Loader } from "@/shared/components/Loader";
import { CategoryCombobox } from "@/modules/expenses/components/CategoryCombobox";

interface DataGridProps {
  transactions?: Transaction[];
  isLoading?: boolean;
  emptyMessage?: string;
}

const FREQ_STYLES: Record<string, string> = {
  daily:    "bg-purple-100 text-purple-700",
  monthly:  "bg-blue-100 text-blue-700",
  yearly:   "bg-orange-100 text-orange-700",
  "one-time": "bg-gray-100 text-gray-600",
};

export function DataGrid({
  transactions: propTransactions,
  isLoading: propLoading,
  emptyMessage = "No transactions found.",
}: DataGridProps = {}) {
  const { transactions: hookTransactions, isLoading: hookLoading } = useFinancialData();
  const queryClient = useQueryClient();

  const transactions = propTransactions ?? hookTransactions;
  const isLoading = propLoading ?? hookLoading;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTx, setEditedTx] = useState<Transaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  function startEdit(tx: Transaction) {
    setEditingId(tx.id);
    setEditedTx({ ...tx });
    setSaveError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditedTx(null);
    setSaveError("");
  }

  function patch(updates: Partial<Transaction>) {
    if (!editedTx) return;
    setEditedTx({ ...editedTx, ...updates });
  }

  async function handleSave() {
    if (!editedTx) return;
    if (!editedTx.description.trim()) { setSaveError("Description is required."); return; }
    if (!editedTx.category) { setSaveError("Category is required."); return; }
    if (!editedTx.amount || editedTx.amount <= 0) { setSaveError("Amount must be greater than 0."); return; }

    setIsSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/transactions/${editedTx.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedTx),
      });

      if (res.ok) {
        setEditingId(null);
        setEditedTx(null);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      } else {
        const json = await res.json().catch(() => ({}));
        setSaveError(json.error ?? "Failed to save. Please try again.");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex justify-center py-16">
        <Loader />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="text-center py-16">
          <p className="text-gray-500 mb-1">{emptyMessage}</p>
          <p className="text-sm text-gray-400">Use "Add Expense" or import an Excel file to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">{transactions.length} transactions</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Frequency</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map((tx) => (
              <tr key={tx.id} className={`hover:bg-gray-50 transition-colors ${editingId === tx.id ? "bg-blue-50" : ""}`}>
                {editingId === tx.id && editedTx ? (
                  /* ── EDIT ROW ── */
                  <>
                    <td className="px-5 py-3">
                      <input
                        type="date"
                        value={editedTx.date}
                        onChange={(e) => patch({ date: e.target.value })}
                        className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <input
                        type="text"
                        value={editedTx.description}
                        onChange={(e) => patch({ description: e.target.value })}
                        className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-w-[180px]"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <CategoryCombobox
                        value={editedTx.category}
                        onChange={(val) => patch({ category: val })}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={editedTx.frequency ?? "one-time"}
                        onChange={(e) => patch({ frequency: e.target.value as Transaction["frequency"] })}
                        className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="daily">Daily</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="one-time">One-time</option>
                      </select>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end">
                        <span className="text-gray-400 mr-1">₹</span>
                        <input
                          type="number"
                          value={editedTx.amount}
                          onChange={(e) => patch({ amount: parseFloat(e.target.value) || 0 })}
                          min="0"
                          step="0.01"
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-28 text-right"
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1 items-center">
                        <div className="flex gap-1">
                          <button
                            onClick={handleSave}
                            disabled={isSaving}
                            title="Save"
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSaving ? <ButtonLoader /> : <Check className="w-3.5 h-3.5" />}
                            {isSaving ? "Saving" : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isSaving}
                            title="Cancel"
                            className="p-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {saveError && (
                          <span className="text-xs text-red-600 text-center max-w-[140px]">{saveError}</span>
                        )}
                      </div>
                    </td>
                  </>
                ) : (
                  /* ── READ ROW ── */
                  <>
                    <td className="px-5 py-3 whitespace-nowrap text-gray-600">
                      {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3 text-gray-800 max-w-xs truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                        {tx.category.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {tx.frequency ? (
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${FREQ_STYLES[tx.frequency] ?? "bg-gray-100 text-gray-600"}`}>
                          {tx.frequency.charAt(0).toUpperCase() + tx.frequency.slice(1)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-right font-semibold text-gray-800">
                      ₹{tx.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => startEdit(tx)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          disabled={deletingId === tx.id}
                          title="Delete"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                        >
                          {deletingId === tx.id ? <ButtonLoader /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
