import { NextResponse } from "next/server";
import { getSession } from "@/core/auth/getSession";
import { loadFromJson, initializeStorage } from "@/core/services/jsonStorageService";
import { Transaction, FinancialSummary } from "@/core/types";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    initializeStorage();
    const transactions = await loadFromJson<Transaction>("transactions", session.userId);

    const totalIncome = transactions
      .filter((tx) => tx.type === "credit")
      .reduce((s, tx) => s + tx.amount, 0);

    const totalExpenses = transactions
      .filter((tx) => tx.type === "debit")
      .reduce((s, tx) => s + tx.amount, 0);

    const categoryBreakdown = transactions
      .filter((tx) => tx.type === "debit")
      .reduce((acc, tx) => {
        acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
        return acc;
      }, {} as Record<string, number>);

    const summary: FinancialSummary = {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      categoryBreakdown,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error computing financial summary:", error);
    return NextResponse.json({ error: "Failed to compute summary" }, { status: 500 });
  }
}
