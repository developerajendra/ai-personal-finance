"use client";

import { Transaction } from "@/shared/types";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface TransactionTableProps {
  transactions: Transaction[];
}

export function TransactionTable({ transactions }: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="panel p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
        <div className="text-center text-muted py-12">
          <p>No transactions found. Upload data in the Admin Panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold">Recent Transactions</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-tile">
            <tr>
              <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="bg-panel divide-y divide-divider">
            {transactions.slice(0, 10).map((transaction) => (
              <tr key={transaction.id} className="hover:bg-tile">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-ink">
                  {new Date(transaction.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-ink">
                  {transaction.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                  {transaction.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    {transaction.type === "credit" ? (
                      <ArrowUpCircle className="w-4 h-4 text-gain" />
                    ) : (
                      <ArrowDownCircle className="w-4 h-4 text-loss" />
                    )}
                    <span
                      className={
                        transaction.type === "credit"
                          ? "text-gain font-semibold"
                          : "text-loss font-semibold"
                      }
                    >
                      ₹{transaction.amount.toLocaleString()}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

