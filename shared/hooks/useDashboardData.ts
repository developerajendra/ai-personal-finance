"use client";

import { useMemo } from "react";
import { usePortfolioData } from "@/modules/portfolio/components/PortfolioAnalytics";
import { useFinancialData } from "@/shared/hooks/useFinancialData";
import { DASHBOARD_COLORS } from "@/shared/constants/dashboardColors";
import { Transaction } from "@/core/types";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} '${String(year).slice(2)}`;
}

export function useDashboardData() {
  const portfolio = usePortfolioData();
  const { transactions, summary, isLoading: isLoadingFinancial } = useFinancialData();

  const isLoading = portfolio.isLoading || isLoadingFinancial;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const currentMonthTxs = useMemo(
    () =>
      transactions.filter((tx) => {
        const d = new Date(tx.date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }),
    [transactions, currentYear, currentMonth]
  );

  const currentMonthIncome = useMemo(
    () =>
      currentMonthTxs
        .filter((tx) => tx.type === "credit")
        .reduce((s, tx) => s + tx.amount, 0),
    [currentMonthTxs]
  );

  const currentMonthExpenses = useMemo(
    () =>
      currentMonthTxs
        .filter((tx) => tx.type === "debit")
        .reduce((s, tx) => s + tx.amount, 0),
    [currentMonthTxs]
  );

  const currentMonthCashFlow = currentMonthIncome - currentMonthExpenses;

  const savingsRate = useMemo(
    () =>
      currentMonthIncome > 0
        ? ((currentMonthIncome - currentMonthExpenses) / currentMonthIncome) * 100
        : 0,
    [currentMonthIncome, currentMonthExpenses]
  );

  const totalAssets = portfolio.totalFixedAssets + portfolio.totalLiquidAssets;

  const debtToAssetRatio = useMemo(
    () => (totalAssets > 0 ? (portfolio.totalLoans / totalAssets) * 100 : 0),
    [portfolio.totalLoans, totalAssets]
  );

  const liquidityRatio = useMemo(
    () =>
      currentMonthExpenses > 0
        ? portfolio.totalLiquidAssets / currentMonthExpenses
        : portfolio.totalLiquidAssets > 0
        ? 999
        : 0,
    [portfolio.totalLiquidAssets, currentMonthExpenses]
  );

  // Last 12 months trend — deterministic key avoids locale mismatch
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { income: number; expenses: number; year: number; month: number }> = {};

    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      map[monthKey(y, m)] = { income: 0, expenses: 0, year: y, month: m };
    }

    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = monthKey(y, m);
      if (!map[key]) return;
      if (tx.type === "credit") map[key].income += tx.amount;
      else map[key].expenses += tx.amount;
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => ({
        month: monthLabel(data.year, data.month),
        income: data.income,
        expenses: data.expenses,
        cashFlow: data.income - data.expenses,
      }));
  }, [transactions, currentYear, currentMonth]);

  const assetAllocation = useMemo(
    () =>
      [
        { name: "Investments", value: portfolio.totalInvestments, color: DASHBOARD_COLORS.investments },
        { name: "Stocks", value: portfolio.totalStocks, color: DASHBOARD_COLORS.stocks },
        { name: "Mutual Funds", value: portfolio.totalMutualFunds, color: DASHBOARD_COLORS.mutualFunds },
        { name: "PPF", value: portfolio.totalPPF, color: DASHBOARD_COLORS.ppf },
        { name: "Properties", value: portfolio.totalProperties, color: DASHBOARD_COLORS.properties },
        { name: "Bank Balances", value: portfolio.totalBankBalances, color: DASHBOARD_COLORS.bank },
        { name: "Receivables", value: portfolio.totalReceivables, color: DASHBOARD_COLORS.receivables },
      ].filter((item) => item.value > 0),
    [portfolio]
  );

  const investmentBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    portfolio.investments
      .filter((inv) => inv.status !== "closed")
      .forEach((inv) => {
        const label =
          inv.type === "fd"
            ? "Fixed Deposit"
            : inv.type === "bonds"
            ? "Bonds"
            : inv.type === "ppf"
            ? "PPF"
            : inv.type === "mutual-fund"
            ? "Mutual Fund"
            : inv.type === "stocks"
            ? "Stocks"
            : "Other";
        map[label] = (map[label] || 0) + inv.amount;
      });
    if (portfolio.totalStocks > 0) map["Stocks"] = (map["Stocks"] || 0) + portfolio.totalStocks;
    if (portfolio.totalMutualFunds > 0)
      map["Mutual Fund"] = (map["Mutual Fund"] || 0) + portfolio.totalMutualFunds;
    if (portfolio.totalPPF > 0) map["PPF"] = (map["PPF"] || 0) + portfolio.totalPPF;
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [portfolio]);

  const loanHealth = useMemo(() => {
    const activeLoans = portfolio.loans.filter((l) => l.status === "active");
    const totalEMI = activeLoans.reduce((s, l) => s + (l.emiAmount || 0), 0);
    const debtToIncome =
      currentMonthIncome > 0 ? (totalEMI / currentMonthIncome) * 100 : 0;
    const highestRateLoan = activeLoans.reduce<(typeof activeLoans)[0] | null>(
      (max, l) => (!max || l.interestRate > max.interestRate ? l : max),
      null
    );
    return { totalEMI, debtToIncome, highestRateLoan, loans: activeLoans };
  }, [portfolio.loans, currentMonthIncome]);

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8),
    [transactions]
  );

  // Previous month income for trend comparison
  const prevMonthIncome = useMemo(() => {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return transactions
      .filter((tx: Transaction) => {
        const d = new Date(tx.date);
        return (
          tx.type === "credit" &&
          d.getFullYear() === prevYear &&
          d.getMonth() === prevMonth
        );
      })
      .reduce((s, tx) => s + tx.amount, 0);
  }, [transactions, currentYear, currentMonth]);

  const prevMonthExpenses = useMemo(() => {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return transactions
      .filter((tx: Transaction) => {
        const d = new Date(tx.date);
        return (
          tx.type === "debit" &&
          d.getFullYear() === prevYear &&
          d.getMonth() === prevMonth
        );
      })
      .reduce((s, tx) => s + tx.amount, 0);
  }, [transactions, currentYear, currentMonth]);

  return {
    // Portfolio data
    netWorth: portfolio.netWorth,
    totalFixedAssets: portfolio.totalFixedAssets,
    totalLiquidAssets: portfolio.totalLiquidAssets,
    totalLoans: portfolio.totalLoans,
    totalInvestments: portfolio.totalInvestments,
    totalProperties: portfolio.totalProperties,
    totalStocks: portfolio.totalStocks,
    totalMutualFunds: portfolio.totalMutualFunds,
    totalPPF: portfolio.totalPPF,
    totalBankBalances: portfolio.totalBankBalances,
    totalReceivables: portfolio.totalReceivables,
    loans: portfolio.loans,
    investments: portfolio.investments,
    totalAssets,

    // All-time income/expenses (from fixed summary)
    totalIncome: summary.totalIncome,
    totalExpenses: summary.totalExpenses,
    cashFlow: summary.netBalance,
    categoryBreakdown: summary.categoryBreakdown,

    // Current month
    currentMonthIncome,
    currentMonthExpenses,
    currentMonthCashFlow,
    savingsRate,
    prevMonthIncome,
    prevMonthExpenses,

    // Ratios
    debtToAssetRatio,
    liquidityRatio,

    // Chart data
    monthlyTrend,
    assetAllocation,
    investmentBreakdown,
    loanHealth,

    // Recent
    recentTransactions,

    isLoading,
  };
}
