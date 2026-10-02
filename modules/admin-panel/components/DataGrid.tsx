"use client";

import { useFinancialData } from "@/shared/hooks/useFinancialData";
import { Transaction } from "@/shared/types";
import { useMemo, useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import { ButtonLoader } from "@/shared/components/Loader";
import { EmptyState, Panel } from "@/shared/components/ui";
import { fmtDate, useMoney } from "@/shared/hooks/useMoney";

export function DataGrid() {
  const { transactions } = useFinancialData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTransaction, setEditedTransaction] = useState<Transaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [fAcct, setFAcct] = useState("All");
  const [fCat, setFCat] = useState("All");
  const [fType, setFType] = useState<"All" | "credit" | "debit">("All");
  const { M, S } = useMoney();

  const accounts = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.account || sourceLabel(t.source)))).sort(),
    [transactions]
  );
  const categoryList = useMemo(() => Array.from(new Set(transactions.map((t) => t.category))).sort(), [transactions]);
  const visible = useMemo(
    () =>
      [...transactions]
        .filter((t) => fAcct === "All" || (t.account || sourceLabel(t.source)) === fAcct)
        .filter((t) => fCat === "All" || t.category === fCat)
        .filter((t) => fType === "All" || t.type === fType)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, fAcct, fCat, fType]
  );
  const moneyIn = visible.filter((t) => t.type === "credit").reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const moneyOut = visible.filter((t) => t.type === "debit").reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditedTransaction({ ...transaction });
  };

  const handleSave = async () => {
    if (!editedTransaction) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/transactions/${editedTransaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedTransaction),
      });

      if (response.ok) {
        setEditingId(null);
        setEditedTransaction(null);
        // Refresh data
        window.location.reload();
      }
    } catch (error) {
      console.error("Error saving transaction:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    setIsDeleting(id);
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Refresh data
        window.location.reload();
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  const inputCls = "input !min-h-[34px] !py-1.5";

  if (transactions.length === 0) {
    return (
      <Panel>
        <EmptyState title="No transactions found.">Upload files in Imports &amp; data to get started.</EmptyState>
      </Panel>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1 sm:flex-none">
          <span className="field-label">Account</span>
          <select className="input sm:w-[248px]" value={fAcct} onChange={(e) => setFAcct(e.target.value)}>
            <option value="All">All</option>
            {accounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[150px]">
          <span className="field-label">Category</span>
          <select className="input sm:w-[150px]" value={fCat} onChange={(e) => setFCat(e.target.value)}>
            <option value="All">All</option>
            {categoryList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Type</span>
          <select className="input sm:w-[140px]" value={fType} onChange={(e) => setFType(e.target.value as typeof fType)}>
            <option value="All">All</option>
            <option value="credit">Money in</option>
            <option value="debit">Money out</option>
          </select>
        </label>
        <p className="pb-2.5 text-[13px] text-muted">
          Showing {visible.length} of {transactions.length} · amounts in INR
        </p>
      </div>

      {/* Totals */}
      <dl className="mb-6 grid grid-cols-2 gap-6 md:grid-cols-4">
        <div>
          <dt className="eyebrow">Money in</dt>
          <dd className="mt-2 text-[26px] font-bold tracking-[-0.02em] text-gain">{M(moneyIn)}</dd>
        </div>
        <div>
          <dt className="eyebrow">Money out</dt>
          <dd className="mt-2 text-[26px] font-bold tracking-[-0.02em]">{M(moneyOut)}</dd>
        </div>
        <div>
          <dt className="eyebrow">Net</dt>
          <dd className={`mt-2 text-[26px] font-bold tracking-[-0.02em] ${moneyIn - moneyOut >= 0 ? "text-gain" : "text-loss"}`}>
            {moneyIn - moneyOut >= 0 ? "▲ " : "▼ "}
            {S(moneyIn - moneyOut)}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Transactions</dt>
          <dd className="mt-2 text-[26px] font-bold tracking-[-0.02em]">{visible.length}</dd>
        </div>
      </dl>

      <Panel className="!px-2 sm:!px-6">
        <ul>
          {visible.map((transaction) =>
            editingId === transaction.id && editedTransaction ? (
              <li key={transaction.id} className="grid grid-cols-1 gap-2 border-b border-divider px-2 py-3 md:grid-cols-[140px_1fr_160px_120px_140px_auto] md:items-center">
                <input
                  type="date"
                  value={editedTransaction.date}
                  onChange={(e) =>
                    setEditedTransaction({
                      ...editedTransaction,
                      date: e.target.value,
                    })
                  }
                  className={inputCls}
                  aria-label="Date"
                />
                <input
                  type="text"
                  value={editedTransaction.description}
                  onChange={(e) =>
                    setEditedTransaction({
                      ...editedTransaction,
                      description: e.target.value,
                    })
                  }
                  className={inputCls}
                  aria-label="Description"
                />
                <input
                  type="text"
                  value={editedTransaction.category}
                  onChange={(e) =>
                    setEditedTransaction({
                      ...editedTransaction,
                      category: e.target.value,
                    })
                  }
                  className={inputCls}
                  aria-label="Category"
                />
                <select
                  value={editedTransaction.type}
                  onChange={(e) =>
                    setEditedTransaction({
                      ...editedTransaction,
                      type: e.target.value as "debit" | "credit",
                    })
                  }
                  className={inputCls}
                  aria-label="Type"
                >
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
                <input
                  type="number"
                  value={editedTransaction.amount}
                  onChange={(e) =>
                    setEditedTransaction({
                      ...editedTransaction,
                      amount: parseFloat(e.target.value),
                    })
                  }
                  className={inputCls}
                  aria-label="Amount"
                />
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={isSaving} className="btn btn-primary btn-sm">
                    {isSaving ? (
                      <>
                        <ButtonLoader />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditedTransaction(null);
                    }}
                    disabled={isSaving}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={transaction.id}
                className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-divider px-2 py-3.5 last:border-0 md:grid-cols-[120px_minmax(0,1fr)_minmax(0,220px)_150px_64px]"
              >
                <span className="order-3 text-[13.5px] text-muted md:order-none md:text-[14.5px]">{fmtDate(transaction.date)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-ink">{transaction.description}</span>
                  <span className="block text-[13px] text-muted">{transaction.category}</span>
                </span>
                <span className="hidden truncate text-center text-[14px] md:block">{transaction.account || sourceLabel(transaction.source)}</span>
                <span className={`text-right text-[15px] tabular-nums ${transaction.type === "credit" ? "text-gain" : "text-ink"}`}>
                  {S(transaction.type === "credit" ? Math.abs(transaction.amount) : -Math.abs(transaction.amount), { dec: 2 })}
                </span>
                <span className="order-4 flex justify-end gap-1 md:order-none md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100">
                  <button
                    onClick={() => handleEdit(transaction)}
                    className="rounded-md p-1.5 text-accent-700 hover:bg-accent-100"
                    title="Edit"
                    aria-label="Edit transaction"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(transaction.id)}
                    disabled={isDeleting === transaction.id}
                    className="rounded-md p-1.5 text-loss hover:bg-loss-bg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete"
                    aria-label="Delete transaction"
                  >
                    {isDeleting === transaction.id ? (
                      <ButtonLoader />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </span>
              </li>
            )
          )}
          {visible.length === 0 && <li className="px-2 py-8 text-center text-[14px] text-muted">No transactions match these filters.</li>}
        </ul>
      </Panel>
    </div>
  );
}

const SOURCE_LABELS: Record<Transaction["source"], string> = {
  excel: "Excel import",
  ocr: "Scanned document",
  kite: "Zerodha",
  "google-drive": "Google Drive",
  manual: "Manual entry",
  chat: "Assistant",
  whatsapp: "WhatsApp",
};
const sourceLabel = (s: Transaction["source"]) => SOURCE_LABELS[s] ?? s;
