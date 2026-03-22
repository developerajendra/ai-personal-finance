import { NextResponse } from "next/server";
import { saveSnapshot, getSnapshot } from "@/core/services/archiveService";
import { FinancialSnapshot } from "@/core/types";
import { loadFromJson } from "@/core/services/jsonStorageService";
import { Investment, Loan, Property, BankBalance, Transaction } from "@/core/types";
import { loadStocks, loadMutualFunds } from "@/core/services/jsonStorageService";
import { PPFAccount, loadPPFAccounts } from "@/core/services/ppfStorageService";

// Calculate current portfolio snapshot
async function calculateCurrentSnapshot(): Promise<Partial<FinancialSnapshot>> {
  // Load all portfolio data
  const investments = loadFromJson<Investment>("investments").filter(
    (inv) => inv.isPublished && inv.status !== "closed"
  );
  const loans = loadFromJson<Loan>("loans").filter((loan) => loan.isPublished);
  const properties = loadFromJson<Property>("properties").filter(
    (prop) => prop.isPublished
  );
  const bankBalances = loadFromJson<BankBalance>("bankBalances").filter(
    (bb) => bb.isPublished
  );
  const transactions = loadFromJson<Transaction>("transactions");
  const stocks = loadStocks();
  const mutualFunds = loadMutualFunds();
  const ppfAccounts = loadPPFAccounts();

  // Calculate totals
  const totalInvestments = investments.reduce((sum, inv) => sum + inv.amount, 0);
  const totalLoans = loans.reduce(
    (sum, loan) => sum + loan.outstandingAmount,
    0
  );
  const totalProperties = properties.reduce(
    (sum, prop) => sum + (prop.currentValue || prop.purchasePrice || 0),
    0
  );
  const totalStocks =
    stocks?.reduce(
      (sum, stock) => sum + ((stock.last_price || 0) * (stock.quantity || 0)),
      0
    ) || 0;
  const totalMutualFunds =
    mutualFunds?.reduce(
      (sum, mf) => sum + ((mf.last_price || 0) * (mf.quantity || 0)),
      0
    ) || 0;
  const totalPPF = ppfAccounts.reduce(
    (sum, account) => sum + (account.grandTotal || 0),
    0
  );
  const totalBankBalances = bankBalances
    .filter((bb: any) => !bb.tags?.includes("receivable"))
    .reduce((sum, bb) => sum + (bb.balance || 0), 0);

  // Calculate receivables
  const totalReceivables = bankBalances
    .filter((bb: any) => bb.tags?.includes("receivable"))
    .reduce((sum, bb: any) => {
      if (bb.interestRate && bb.issueDate) {
        const principal = bb.balance || 0;
        const interestRate = bb.interestRate / 100;
        const issueDate = new Date(bb.issueDate);
        const dueDate = bb.dueDate ? new Date(bb.dueDate) : new Date();
        const daysDiff = Math.max(
          0,
          Math.floor(
            (dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
        const years = daysDiff / 365;
        const interestAmount = principal * interestRate * years;
        return sum + (principal + interestAmount);
      }
      return sum + (bb.balance || 0);
    }, 0);

  // Calculate Fixed and Liquid Assets
  const fixedAssetsFromInvestments = investments.reduce(
    (sum, inv) => sum + (inv.assetType === "fixed" ? inv.amount : 0),
    0
  );
  const fixedAssetsFromProperties = properties.reduce((sum, prop) => {
    const value = prop.currentValue || prop.purchasePrice || 0;
    return sum + (prop.assetType === "liquid" ? 0 : value);
  }, 0);
  const fixedAssetsFromBankBalances = bankBalances
    .filter(
      (bb: any) => !bb.tags?.includes("receivable") && bb.assetType === "fixed"
    )
    .reduce((sum, bb) => sum + (bb.balance || 0), 0);

  const totalFixedAssets =
    fixedAssetsFromInvestments + fixedAssetsFromProperties + fixedAssetsFromBankBalances;

  const liquidAssetsFromInvestments = investments.reduce(
    (sum, inv) => sum + (inv.assetType === "fixed" ? 0 : inv.amount),
    0
  );
  const liquidAssetsFromProperties = properties.reduce((sum, prop) => {
    const value = prop.currentValue || prop.purchasePrice || 0;
    return sum + (prop.assetType === "liquid" ? value : 0);
  }, 0);
  const liquidAssetsFromBankBalances = bankBalances
    .filter((bb: any) => {
      if (bb.tags?.includes("receivable")) return true;
      return bb.assetType !== "fixed";
    })
    .reduce((sum, bb: any) => {
      if (bb.tags?.includes("receivable")) {
        if (bb.interestRate && bb.issueDate) {
          const principal = bb.balance || 0;
          const interestRate = bb.interestRate / 100;
          const issueDate = new Date(bb.issueDate);
          const dueDate = bb.dueDate ? new Date(bb.dueDate) : new Date();
          const daysDiff = Math.max(
            0,
            Math.floor(
              (dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          );
          const years = daysDiff / 365;
          const interestAmount = principal * interestRate * years;
          return sum + (principal + interestAmount);
        }
        return sum + (bb.balance || 0);
      }
      return sum + (bb.balance || 0);
    }, 0);

  const totalLiquidAssets =
    liquidAssetsFromInvestments +
    liquidAssetsFromProperties +
    totalStocks +
    totalMutualFunds +
    totalPPF +
    liquidAssetsFromBankBalances;

  const netWorth = totalFixedAssets + totalLiquidAssets - totalLoans;

  // Calculate transaction totals
  const totalIncome = transactions
    .filter((t) => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;

  // Calculate breakdowns
  const investmentBreakdown = investments.reduce((acc, inv) => {
    acc[inv.type] = (acc[inv.type] || 0) + inv.amount;
    return acc;
  }, {} as Record<string, number>);

  if (totalStocks > 0) {
    investmentBreakdown["stocks"] =
      (investmentBreakdown["stocks"] || 0) + totalStocks;
  }
  if (totalMutualFunds > 0) {
    investmentBreakdown["mutual-fund"] =
      (investmentBreakdown["mutual-fund"] || 0) + totalMutualFunds;
  }
  if (totalPPF > 0) {
    investmentBreakdown["provident-fund"] =
      (investmentBreakdown["provident-fund"] || 0) + totalPPF;
  }

  const loanBreakdown = loans.reduce((acc, loan) => {
    acc[loan.type] = (acc[loan.type] || 0) + loan.outstandingAmount;
    return acc;
  }, {} as Record<string, number>);

  const propertyBreakdown = properties.reduce((acc, prop) => {
    const value = prop.currentValue || prop.purchasePrice || 0;
    acc[prop.type] = (acc[prop.type] || 0) + value;
    return acc;
  }, {} as Record<string, number>);

  const categoryBreakdown = transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalInvestments,
    totalLoans,
    totalProperties,
    totalBankBalances,
    totalReceivables,
    totalStocks,
    totalMutualFunds,
    totalPPF,
    totalFixedAssets,
    totalLiquidAssets,
    netWorth,
    totalIncome,
    totalExpenses,
    netBalance,
    investmentBreakdown,
    loanBreakdown,
    propertyBreakdown,
    categoryBreakdown,
  };
}

// POST: Create snapshot from current data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { year, month } = body;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Determine year and month if not provided
    const snapshotYear = year || currentYear;
    const snapshotMonth = month || (snapshotYear === currentYear ? currentMonth : undefined);

    // For 2025, always create monthly snapshot (December)
    // For past years (before 2025), create yearly snapshot
    // For current/upcoming years, create monthly snapshot
    const isPastYear = snapshotYear < 2025;
    const finalMonth = isPastYear ? undefined : (snapshotMonth || (snapshotYear === 2025 ? 12 : undefined));

    let snapshotData: Partial<FinancialSnapshot>;

    // Special handling for December 2025 - duplicate January 2026 data
    if (snapshotYear === 2025 && finalMonth === 12) {
      // Specifically look for January 2026
      const january2026 = getSnapshot(2026, 1);
      
      if (january2026) {
        // Duplicate January 2026 data for December 2025
        snapshotData = {
          totalInvestments: january2026.totalInvestments || 0,
          totalLoans: january2026.totalLoans || 0,
          totalProperties: january2026.totalProperties || 0,
          totalBankBalances: january2026.totalBankBalances || 0,
          totalReceivables: january2026.totalReceivables || 0,
          totalStocks: january2026.totalStocks || 0,
          totalMutualFunds: january2026.totalMutualFunds || 0,
          totalPPF: january2026.totalPPF || 0,
          totalFixedAssets: january2026.totalFixedAssets || 0,
          totalLiquidAssets: january2026.totalLiquidAssets || 0,
          netWorth: january2026.netWorth || 0,
          totalIncome: january2026.totalIncome || 0,
          totalExpenses: january2026.totalExpenses || 0,
          netBalance: january2026.netBalance || 0,
          investmentBreakdown: JSON.parse(JSON.stringify(january2026.investmentBreakdown || {})),
          loanBreakdown: JSON.parse(JSON.stringify(january2026.loanBreakdown || {})),
          propertyBreakdown: JSON.parse(JSON.stringify(january2026.propertyBreakdown || {})),
          categoryBreakdown: JSON.parse(JSON.stringify(january2026.categoryBreakdown || {})),
        };
        console.log("✅ Duplicated January 2026 data for December 2025");
      } else {
        // If no January 2026 snapshot exists, try current year January or calculate from current portfolio
        const currentYearJanuary = getSnapshot(currentYear, 1);
        if (currentYearJanuary && currentYear >= 2026) {
          snapshotData = {
            totalInvestments: currentYearJanuary.totalInvestments || 0,
            totalLoans: currentYearJanuary.totalLoans || 0,
            totalProperties: currentYearJanuary.totalProperties || 0,
            totalBankBalances: currentYearJanuary.totalBankBalances || 0,
            totalReceivables: currentYearJanuary.totalReceivables || 0,
            totalStocks: currentYearJanuary.totalStocks || 0,
            totalMutualFunds: currentYearJanuary.totalMutualFunds || 0,
            totalPPF: currentYearJanuary.totalPPF || 0,
            totalFixedAssets: currentYearJanuary.totalFixedAssets || 0,
            totalLiquidAssets: currentYearJanuary.totalLiquidAssets || 0,
            netWorth: currentYearJanuary.netWorth || 0,
            totalIncome: currentYearJanuary.totalIncome || 0,
            totalExpenses: currentYearJanuary.totalExpenses || 0,
            netBalance: currentYearJanuary.netBalance || 0,
            investmentBreakdown: JSON.parse(JSON.stringify(currentYearJanuary.investmentBreakdown || {})),
            loanBreakdown: JSON.parse(JSON.stringify(currentYearJanuary.loanBreakdown || {})),
            propertyBreakdown: JSON.parse(JSON.stringify(currentYearJanuary.propertyBreakdown || {})),
            categoryBreakdown: JSON.parse(JSON.stringify(currentYearJanuary.categoryBreakdown || {})),
          };
          console.log(`✅ Duplicated ${currentYear} January data for December 2025`);
        } else {
          // If no January snapshot exists, calculate from current portfolio
          console.log("⚠️ No January snapshot found, using current portfolio data");
          snapshotData = await calculateCurrentSnapshot();
        }
      }
    } else {
      // Calculate snapshot data from current portfolio
      snapshotData = await calculateCurrentSnapshot();
    }

    // Create snapshot date (end of month for monthly, end of year for yearly)
    let snapshotDate: string;
    if (finalMonth) {
      // Last day of the month at end of day
      const lastDay = new Date(snapshotYear, finalMonth, 0);
      lastDay.setHours(23, 59, 59, 999);
      snapshotDate = lastDay.toISOString();
    } else {
      // Last day of the year
      const lastDay = new Date(snapshotYear, 11, 31);
      lastDay.setHours(23, 59, 59, 999);
      snapshotDate = lastDay.toISOString();
    }

    const defaults: FinancialSnapshot = {
      id: `${snapshotYear}-${finalMonth || "year"}-${Date.now()}`,
      year: snapshotYear,
      month: finalMonth,
      period: finalMonth ? "monthly" : "yearly",
      snapshotDate,
      totalInvestments: 0,
      totalLoans: 0,
      totalProperties: 0,
      totalBankBalances: 0,
      totalReceivables: 0,
      totalStocks: 0,
      totalMutualFunds: 0,
      totalPPF: 0,
      totalFixedAssets: 0,
      totalLiquidAssets: 0,
      netWorth: 0,
      totalIncome: 0,
      totalExpenses: 0,
      netBalance: 0,
      investmentBreakdown: {},
      loanBreakdown: {},
      propertyBreakdown: {},
      categoryBreakdown: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const snapshot: FinancialSnapshot = { ...defaults, ...snapshotData };

    const saved = saveSnapshot(snapshot);

    return NextResponse.json(
      {
        success: true,
        snapshot: saved,
        message: `Snapshot created for ${finalMonth ? `${getMonthName(finalMonth)} ${snapshotYear}` : snapshotYear}`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating snapshot:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create snapshot" },
      { status: 500 }
    );
  }
}

function getMonthName(month: number): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[month - 1] || "";
}
