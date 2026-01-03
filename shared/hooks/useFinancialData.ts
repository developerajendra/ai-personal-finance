"use client";

import { useQuery } from "@tanstack/react-query";
import { Transaction, FinancialSummary } from "@/core/types";

export function useFinancialData() {
  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      const response = await fetch("/api/transactions");
      if (!response.ok) throw new Error("Failed to fetch transactions");
      return response.json();
    },
  });

  const { data: summary, isLoading: isLoadingSummary } = useQuery<FinancialSummary>({
    queryKey: ["financial-summary"],
    queryFn: async () => {
      const response = await fetch("/api/financial-summary");
      if (!response.ok) throw new Error("Failed to fetch summary");
      return response.json();
    },
  });

  const categories = Array.from(
    new Set(transactions.map((t) => t.category))
  );

  return {
    transactions,
    summary: summary || {
      totalIncome: 0,
      totalExpenses: 0,
      netBalance: 0,
      categoryBreakdown: {},
    },
    categories,
    isLoading: isLoadingTransactions || isLoadingSummary,
  };
}

