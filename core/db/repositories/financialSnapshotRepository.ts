import { db } from "@/core/db";
import { financialSnapshots } from "@/core/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { FinancialSnapshot } from "@/core/types";

type SnapshotRow = typeof financialSnapshots.$inferSelect;

function toAppModel(row: SnapshotRow): FinancialSnapshot {
  return {
    id: row.id,
    year: row.year,
    month: row.month ?? undefined,
    period: row.period as FinancialSnapshot["period"],
    snapshotDate: row.snapshotDate,
    totalInvestments: row.totalInvestments,
    totalLoans: row.totalLoans,
    totalProperties: row.totalProperties,
    totalBankBalances: row.totalBankBalances,
    totalReceivables: row.totalReceivables,
    totalStocks: row.totalStocks,
    totalMutualFunds: row.totalMutualFunds,
    totalPPF: row.totalPPF,
    totalFixedAssets: row.totalFixedAssets,
    totalLiquidAssets: row.totalLiquidAssets,
    netWorth: row.netWorth,
    totalIncome: row.totalIncome,
    totalExpenses: row.totalExpenses,
    netBalance: row.netBalance,
    investmentBreakdown: row.investmentBreakdown ?? {},
    loanBreakdown: row.loanBreakdown ?? {},
    propertyBreakdown: row.propertyBreakdown ?? {},
    categoryBreakdown: row.categoryBreakdown ?? {},
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

export async function findByUserId(userId: string): Promise<FinancialSnapshot[]> {
  const rows = await db.select().from(financialSnapshots).where(eq(financialSnapshots.userId, userId));
  return rows.map(toAppModel);
}

export async function findByYearMonth(userId: string, year: number, month?: number): Promise<FinancialSnapshot | null> {
  let rows;
  if (month === undefined) {
    rows = await db
      .select()
      .from(financialSnapshots)
      .where(and(eq(financialSnapshots.userId, userId), eq(financialSnapshots.year, year), isNull(financialSnapshots.month)))
      .limit(1);
  } else {
    rows = await db
      .select()
      .from(financialSnapshots)
      .where(and(eq(financialSnapshots.userId, userId), eq(financialSnapshots.year, year), eq(financialSnapshots.month, month)))
      .limit(1);
  }
  return rows.length > 0 ? toAppModel(rows[0]) : null;
}

export async function findByYear(userId: string, year: number): Promise<FinancialSnapshot[]> {
  const rows = await db
    .select()
    .from(financialSnapshots)
    .where(and(eq(financialSnapshots.userId, userId), eq(financialSnapshots.year, year)));
  return rows
    .map(toAppModel)
    .sort((a, b) => {
      if (a.month !== undefined && b.month !== undefined) return a.month - b.month;
      return new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime();
    });
}

export async function upsert(userId: string, data: FinancialSnapshot): Promise<FinancialSnapshot> {
  const existing = await findByYearMonth(userId, data.year, data.month);
  const now = new Date().toISOString();

  if (existing) {
    await db.update(financialSnapshots)
      .set({
        ...data,
        userId,
        month: data.month ?? null,
        investmentBreakdown: data.investmentBreakdown ?? null,
        loanBreakdown: data.loanBreakdown ?? null,
        propertyBreakdown: data.propertyBreakdown ?? null,
        categoryBreakdown: data.categoryBreakdown ?? null,
        updatedAt: now,
      })
      .where(and(eq(financialSnapshots.userId, userId), eq(financialSnapshots.id, existing.id)));
  } else {
    await db.insert(financialSnapshots)
      .values({
        ...data,
        userId,
        month: data.month ?? null,
        investmentBreakdown: data.investmentBreakdown ?? null,
        loanBreakdown: data.loanBreakdown ?? null,
        propertyBreakdown: data.propertyBreakdown ?? null,
        categoryBreakdown: data.categoryBreakdown ?? null,
      });
  }
  return findByYearMonth(userId, data.year, data.month) as Promise<FinancialSnapshot>;
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(financialSnapshots).where(and(eq(financialSnapshots.userId, userId), eq(financialSnapshots.id, id)));
  return result.rowsAffected > 0;
}

export async function getAvailableYears(userId: string): Promise<number[]> {
  const all = await findByUserId(userId);
  return [...new Set(all.map((s) => s.year))].sort((a, b) => b - a);
}

export async function getAvailableMonths(userId: string, year: number): Promise<number[]> {
  const byYear = await findByYear(userId, year);
  return byYear.filter((s) => s.month !== undefined).map((s) => s.month!).sort((a, b) => a - b);
}
