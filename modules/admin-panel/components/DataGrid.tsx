"use client";

import { useFinancialData } from "@/shared/hooks/useFinancialData";
import { Transaction } from "@/core/types";
import { useState } from "react";
import { Edit2, Trash2, Plus } from "lucide-react";

export function DataGrid() {
  const { transactions } = useFinancialData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTransaction, setEditedTransaction] = useState<Transaction | null>(null);

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditedTransaction({ ...transaction });
  };

  const handleSave = async () => {
    if (!editedTransaction) return;

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
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

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
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No transactions found.</p>
          <p className="text-sm text-gray-400">
            Upload files in the Upload Files tab to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="p-6 border-b flex items-center justify-between">
        <h2 className="text-xl font-semibold">Financial Data</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
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
                      <input
                        type="text"
                        value={editedTransaction.category}
                        onChange={(e) =>
                          setEditedTransaction({
                            ...editedTransaction,
                            category: e.target.value,
                          })
                        }
                        className="px-2 py-1 border rounded"
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
                          className="text-green-600 hover:text-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditedTransaction(null);
                          }}
                          className="text-gray-600 hover:text-gray-700"
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
                      {transaction.category}
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
                          className="text-red-600 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
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

