"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, ArrowUpCircle, CalendarDays, RefreshCcw } from "lucide-react";
import { Transaction } from "@/core/types";
import { formatIndianNumber } from "@/core/services/currencyService";

interface IncomeDataGridProps {
  transactions: Transaction[];
  isLoading: boolean;
  emptyMessage?: string;
}

const FREQ_BADGE: Record<string, string> = {
  monthly: "bg-blue-50 text-blue-700",
  yearly: "bg-purple-50 text-purple-700",
  "one-time": "bg-gray-100 text-gray-600",
  daily: "bg-orange-50 text-orange-700",
};

const FREQ_ICON: Record<string, React.ReactNode> = {
  monthly: <RefreshCcw className="w-3 h-3" />,
  yearly: <CalendarDays className="w-3 h-3" />,
  "one-time": <ArrowUpCircle className="w-3 h-3" />,
};

function formatLabel(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function IncomeDataGrid({ transactions, isLoading, emptyMessage }: IncomeDataGridProps) {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string, desc: string) {
    if (!confirm(`Delete "${desc}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      }
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ArrowUpCircle className="w-10 h-10 text-gray-200 mb-3" />
        <p className="text-gray-400 text-sm">{emptyMessage || "No income records found."}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Frequency</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-emerald-50/30 transition-colors group">
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {formatDate(tx.date)}
              </td>
              <td className="px-4 py-3">
                <span className="text-gray-800 font-medium">{tx.description}</span>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                  {formatLabel(tx.category)}
                </span>
              </td>
              <td className="px-4 py-3">
                {tx.frequency && (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${FREQ_BADGE[tx.frequency] || "bg-gray-100 text-gray-600"}`}>
                    {FREQ_ICON[tx.frequency]}
                    {formatLabel(tx.frequency)}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-emerald-700 font-bold">
                  +₹{formatIndianNumber(tx.amount)}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => handleDelete(tx.id, tx.description)}
                  disabled={deletingId === tx.id}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
