"use client";

import { useMemo } from "react";
import { usePortfolioData } from "@/modules/portfolio/components/PortfolioAnalytics";
import { useFinancialData } from "@/shared/hooks/useFinancialData";
import { DASHBOARD_COLORS } from "@/shared/constants/dashboardColors";
import { Transaction } from "@/core/types";
import { getCurrentInvestmentValue } from "@/core/utils/investmentValueCalculator";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} '${String(year).slice(2)}`;
}

export interface AssetItem {
  id: string;
  name: string;
  category: string;
  value: number;
  interestRate?: number;
  monthlyIncome?: number;
  maturityDate?: string;
  detail?: string;
}

export interface InvestmentIncomeItem {
  source: string;
  type: string;
  rate: number;
  monthlyIncome: number;
}

// PPF standard interest rate (Government of India)
const PPF_RATE = 7.1;

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

  // Monthly investment income: FD + bond interest + PPF
  const investmentIncomeBreakdown = useMemo((): InvestmentIncomeItem[] => {
    const items: InvestmentIncomeItem[] = [];

    // FD and bond interest
    portfolio.investments
      .filter(
        (inv) =>
          (inv.type === "fd" || inv.type === "bonds") &&
          inv.status !== "closed" &&
          (inv.interestRate || 0) > 0
      )
      .forEach((inv) => {
        const monthly = (inv.amount * (inv.interestRate || 0)) / 100 / 12;
        if (monthly > 0) {
          items.push({
            source: inv.name,
            type: inv.type === "fd" ? "Fixed Deposit" : "Bonds",
            rate: inv.interestRate || 0,
            monthlyIncome: monthly,
          });
        }
      });

    // PPF at standard rate on accumulated corpus
    const ppfTotal = portfolio.ppfAccounts.reduce(
      (s: number, a: any) => s + (a.grandTotal || 0),
      0
    );
    if (ppfTotal > 0) {
      items.push({
        source: "PPF Accounts",
        type: "PPF",
        rate: PPF_RATE,
        monthlyIncome: (ppfTotal * PPF_RATE) / 100 / 12,
      });
    }

    // Fixed bank balances with interest (FD at bank)
    portfolio.bankBalances
      .filter(
        (bb: any) =>
          !(bb.tags?.includes("receivable")) &&
          bb.assetType === "fixed" &&
          (bb.interestRate || 0) > 0
      )
      .forEach((bb: any) => {
        const monthly = (bb.balance * bb.interestRate) / 100 / 12;
        if (monthly > 0) {
          items.push({
            source: bb.bankName,
            type: "Bank FD",
            rate: bb.interestRate,
            monthlyIncome: monthly,
          });
        }
      });

    return items;
  }, [portfolio.investments, portfolio.ppfAccounts, portfolio.bankBalances]);

  const monthlyInvestmentIncome = useMemo(
    () => investmentIncomeBreakdown.reduce((s, i) => s + i.monthlyIncome, 0),
    [investmentIncomeBreakdown]
  );

  const savingsRate = useMemo(() => {
    const totalMonthlyIncome = currentMonthIncome + monthlyInvestmentIncome;
    return totalMonthlyIncome > 0
      ? ((totalMonthlyIncome - currentMonthExpenses) / totalMonthlyIncome) * 100
      : 0;
  }, [currentMonthIncome, monthlyInvestmentIncome, currentMonthExpenses]);

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
    const totalIncome = currentMonthIncome + monthlyInvestmentIncome;
    const debtToIncome = totalIncome > 0 ? (totalEMI / totalIncome) * 100 : 0;
    const highestRateLoan = activeLoans.reduce<(typeof activeLoans)[0] | null>(
      (max, l) => (!max || l.interestRate > max.interestRate ? l : max),
      null
    );
    return { totalEMI, debtToIncome, highestRateLoan, loans: activeLoans };
  }, [portfolio.loans, currentMonthIncome, monthlyInvestmentIncome]);

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8),
    [transactions]
  );

  // Previous month
  const prevMonthIncome = useMemo(() => {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return transactions
      .filter((tx: Transaction) => {
        const d = new Date(tx.date);
        return tx.type === "credit" && d.getFullYear() === prevYear && d.getMonth() === prevMonth;
      })
      .reduce((s, tx) => s + tx.amount, 0);
  }, [transactions, currentYear, currentMonth]);

  const prevMonthExpenses = useMemo(() => {
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return transactions
      .filter((tx: Transaction) => {
        const d = new Date(tx.date);
        return tx.type === "debit" && d.getFullYear() === prevYear && d.getMonth() === prevMonth;
      })
      .reduce((s, tx) => s + tx.amount, 0);
  }, [transactions, currentYear, currentMonth]);

  // ─── Fixed asset detail list (for modal drill-down) ───────────────────────
  const fixedAssetItems = useMemo((): AssetItem[] => {
    const items: AssetItem[] = [];

    portfolio.investments
      .filter((inv) => inv.assetType === "fixed" && inv.status !== "closed")
      .forEach((inv) => {
        const value = getCurrentInvestmentValue(inv);
        items.push({
          id: inv.id,
          name: inv.name,
          category: inv.type === "fd" ? "Fixed Deposit" : inv.type === "bonds" ? "Bonds" : "Investment",
          value,
          interestRate: inv.interestRate,
          monthlyIncome:
            inv.interestRate ? (inv.amount * inv.interestRate) / 100 / 12 : undefined,
          maturityDate: inv.maturityDate || inv.endDate,
          detail: inv.description,
        });
      });

    portfolio.properties
      .filter((prop) => prop.assetType !== "liquid")
      .forEach((prop) => {
        items.push({
          id: prop.id,
          name: prop.name,
          category: prop.type.charAt(0).toUpperCase() + prop.type.slice(1),
          value: prop.currentValue || prop.purchasePrice,
          detail: prop.location,
        });
      });

    portfolio.bankBalances
      .filter(
        (bb: any) => !(bb.tags?.includes("receivable")) && bb.assetType === "fixed"
      )
      .forEach((bb: any) => {
        items.push({
          id: bb.id,
          name: bb.bankName,
          category: "Bank FD",
          value: bb.balance,
          interestRate: bb.interestRate,
          monthlyIncome:
            bb.interestRate ? (bb.balance * bb.interestRate) / 100 / 12 : undefined,
          detail: bb.accountType,
        });
      });

    return items.sort((a, b) => b.value - a.value);
  }, [portfolio.investments, portfolio.properties, portfolio.bankBalances]);

  // ─── Liquid asset detail list (for modal drill-down) ─────────────────────
  const liquidAssetItems = useMemo((): AssetItem[] => {
    const items: AssetItem[] = [];

    portfolio.investments
      .filter((inv) => inv.assetType !== "fixed" && inv.status !== "closed")
      .forEach((inv) => {
        const value = getCurrentInvestmentValue(inv);
        items.push({
          id: inv.id,
          name: inv.name,
          category:
            inv.type === "mutual-fund"
              ? "Mutual Fund"
              : inv.type === "ppf"
              ? "PPF"
              : inv.type === "stocks"
              ? "Stocks"
              : "Investment",
          value,
          interestRate: inv.interestRate,
          detail: inv.description,
        });
      });

    // Zerodha stocks
    (portfolio.stocksData?.stocks || []).forEach((s: any, i: number) => {
      const value = (s.last_price || 0) * (s.quantity || 0);
      if (value > 0) {
        items.push({
          id: `stock-${i}`,
          name: s.tradingsymbol || s.name || "Stock",
          category: "Stocks",
          value,
          detail: `${s.quantity} shares @ ₹${Number(s.last_price || 0).toFixed(2)}`,
        });
      }
    });

    // Zerodha mutual funds
    (portfolio.mutualFundsData?.mutualFunds || []).forEach((mf: any, i: number) => {
      const value = (mf.last_price || 0) * (mf.quantity || 0);
      if (value > 0) {
        items.push({
          id: `mf-${i}`,
          name: mf.fund_name || mf.tradingsymbol || "Mutual Fund",
          category: "Mutual Fund",
          value,
          detail: `${mf.quantity} units @ ₹${Number(mf.last_price || 0).toFixed(2)}`,
        });
      }
    });

    // PPF accounts
    portfolio.ppfAccounts.forEach((acc: any) => {
      if ((acc.grandTotal || 0) > 0) {
        items.push({
          id: acc.id,
          name: acc.memberName || acc.establishmentName || "PPF Account",
          category: "PPF",
          value: acc.grandTotal,
          interestRate: PPF_RATE,
          monthlyIncome: (acc.grandTotal * PPF_RATE) / 100 / 12,
        });
      }
    });

    // Liquid bank balances
    portfolio.bankBalances
      .filter(
        (bb: any) => !(bb.tags?.includes("receivable")) && bb.assetType !== "fixed"
      )
      .forEach((bb: any) => {
        items.push({
          id: bb.id,
          name: bb.bankName,
          category: "Bank Balance",
          value: bb.balance,
          detail: bb.accountType,
        });
      });

    // Receivables
    portfolio.bankBalances
      .filter((bb: any) => bb.tags?.includes("receivable"))
      .forEach((bb: any) => {
        let value = bb.balance;
        if (bb.interestRate && bb.issueDate) {
          const dueDate = bb.dueDate ? new Date(bb.dueDate) : new Date();
          const issueDate = new Date(bb.issueDate);
          const years = Math.max(
            0,
            (dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
          );
          value = bb.balance + (bb.balance * bb.interestRate * years) / 100;
        }
        items.push({
          id: bb.id,
          name: bb.bankName,
          category: "Receivable",
          value,
          interestRate: bb.interestRate,
          detail: bb.dueDate
            ? `Due: ${new Date(bb.dueDate).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}`
            : undefined,
        });
      });

    return items.sort((a, b) => b.value - a.value);
  }, [
    portfolio.investments,
    portfolio.stocksData,
    portfolio.mutualFundsData,
    portfolio.ppfAccounts,
    portfolio.bankBalances,
  ]);

  return {
    // Portfolio totals
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

    // All-time summary
    totalIncome: summary.totalIncome,
    totalExpenses: summary.totalExpenses,
    cashFlow: summary.netBalance,
    categoryBreakdown: summary.categoryBreakdown,

    // Current month transaction income
    currentMonthIncome,
    currentMonthExpenses,
    currentMonthCashFlow,
    savingsRate,
    prevMonthIncome,
    prevMonthExpenses,

    // Investment income (FD, bonds, PPF)
    monthlyInvestmentIncome,
    investmentIncomeBreakdown,

    // Ratios
    debtToAssetRatio,
    liquidityRatio,

    // Charts
    monthlyTrend,
    assetAllocation,
    investmentBreakdown,
    loanHealth,

    // Recent transactions
    recentTransactions,

    // Asset detail lists for modal drill-down
    fixedAssetItems,
    liquidAssetItems,

    isLoading,
  };
}
