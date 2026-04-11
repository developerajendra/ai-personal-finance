"use client";

import { useFinancialData } from "@/shared/hooks/useFinancialData";
import { Transaction } from "@/core/types";
import { useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import { ButtonLoader, Loader } from "@/shared/components/Loader";
import { CategoryCombobox } from "@/modules/expenses/components/CategoryCombobox";

interface DataGridProps {
  transactions?: Transaction[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataGrid({
  transactions: propTransactions,
  isLoading: propLoading,
  emptyMessage = "No transactions found.",
}: DataGridProps = {}) {
  const { transactions: hookTransactions, isLoading: hookLoading } = useFinancialData();

  const transactions = propTransactions ?? hookTransactions;
  const isLoading = propLoading ?? hookLoading;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTransaction, setEditedTransaction] = useState<Transaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

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
        window.location.reload();
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 flex justify-center py-16">
        <Loader />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">{emptyMessage}</p>
          <p className="text-sm text-gray-400">
            Add an expense above or upload files in the Data tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="p-4 border-b">
        <span className="text-sm text-gray-500">{transactions.length} transactions</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-gray-50">
                {editingId === transaction.id && editedTransaction ? (
                  <>
                    <td className="px-6 py-4">
                      <input
                        type="date"
                        value={editedTransaction.date}
                        onChange={(e) =>
                          setEditedTransaction({
                            ...editedTransaction,
                            date: e.target.value,
                          })
                        }
                        className="px-2 py-1 border rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={editedTransaction.description}
                        onChange={(e) =>
                          setEditedTransaction({
                            ...editedTransaction,
                            description: e.target.value,
                          })
                        }
                        className="px-2 py-1 border rounded w-full"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <CategoryCombobox
                        value={editedTransaction.category}
                        onChange={(val) =>
                          setEditedTransaction({ ...editedTransaction, category: val })
                        }
                      />
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={editedTransaction.type}
                        onChange={(e) =>
                          setEditedTransaction({
                            ...editedTransaction,
                            type: e.target.value as "debit" | "credit",
                          })
                        }
                        className="px-2 py-1 border rounded"
                      >
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={editedTransaction.amount}
                        onChange={(e) =>
                          setEditedTransaction({
                            ...editedTransaction,
                            amount: parseFloat(e.target.value),
                          })
                        }
                        className="px-2 py-1 border rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
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
                          className="text-gray-600 hover:text-gray-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">{transaction.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                        {transaction.category
                          .split("-")
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(" ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          transaction.type === "credit"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                      ₹{transaction.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          disabled={isDeleting === transaction.id}
                          className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete"
                        >
                          {isDeleting === transaction.id ? (
                            <ButtonLoader />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
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
