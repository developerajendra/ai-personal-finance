import { db } from "@/core/db";
import { loanSnapshots } from "@/core/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { LoanMonthlySnapshot } from "@/core/types";

type SnapshotRow = typeof loanSnapshots.$inferSelect;

function toAppModel(row: SnapshotRow): LoanMonthlySnapshot {
  return {
    id: row.id,
    loanId: row.loanId,
    year: row.year,
    month: row.month,
    outstandingAmount: row.outstandingAmount,
    principalPaid: row.principalPaid,
    interestPaid: row.interestPaid,
    emiAmount: row.emiAmount,
    interestRate: row.interestRate,
    remainingTenureMonths: row.remainingTenureMonths,
    snapshotDate: row.snapshotDate,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

export async function findByUserId(userId: string): Promise<LoanMonthlySnapshot[]> {
  const rows = await db.select().from(loanSnapshots).where(eq(loanSnapshots.userId, userId));
  return rows.map(toAppModel);
}

export async function findByLoanId(userId: string, loanId: string): Promise<LoanMonthlySnapshot[]> {
  const rows = await db
    .select()
    .from(loanSnapshots)
    .where(and(eq(loanSnapshots.userId, userId), eq(loanSnapshots.loanId, loanId)));
  return rows
    .map(toAppModel)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

export async function findByLoanAndMonth(userId: string, loanId: string, year: number, month: number): Promise<LoanMonthlySnapshot | null> {
  const rows = await db
    .select()
    .from(loanSnapshots)
    .where(
      and(
        eq(loanSnapshots.userId, userId),
        eq(loanSnapshots.loanId, loanId),
        eq(loanSnapshots.year, year),
        eq(loanSnapshots.month, month)
      )
    )
    .limit(1);
  const [row] = rows;
  return row ? toAppModel(row) : null;
}

export async function findByMonth(userId: string, year: number, month: number): Promise<LoanMonthlySnapshot[]> {
  const rows = await db
    .select()
    .from(loanSnapshots)
    .where(and(eq(loanSnapshots.userId, userId), eq(loanSnapshots.year, year), eq(loanSnapshots.month, month)));
  return rows.map(toAppModel);
}

export async function findByYear(userId: string, loanId: string, year: number): Promise<LoanMonthlySnapshot[]> {
  const rows = await db
    .select()
    .from(loanSnapshots)
    .where(and(eq(loanSnapshots.userId, userId), eq(loanSnapshots.loanId, loanId), eq(loanSnapshots.year, year)));
  return rows
    .map(toAppModel)
    .sort((a, b) => a.month - b.month);
}

export async function findLatest(userId: string, loanId: string): Promise<LoanMonthlySnapshot | null> {
  const all = await findByLoanId(userId, loanId);
  return all.length > 0 ? all[all.length - 1] : null;
}

export async function create(userId: string, data: LoanMonthlySnapshot): Promise<LoanMonthlySnapshot> {
  await db.insert(loanSnapshots).values({ ...data, userId });
  return findByLoanAndMonth(userId, data.loanId, data.year, data.month) as Promise<LoanMonthlySnapshot>;
}

export async function upsert(userId: string, data: LoanMonthlySnapshot): Promise<LoanMonthlySnapshot> {
  const existing = await findByLoanAndMonth(userId, data.loanId, data.year, data.month);
  if (existing) {
    await db.update(loanSnapshots)
      .set({
        outstandingAmount: data.outstandingAmount,
        principalPaid: data.principalPaid,
        interestPaid: data.interestPaid,
        emiAmount: data.emiAmount,
        interestRate: data.interestRate,
        remainingTenureMonths: data.remainingTenureMonths,
        snapshotDate: data.snapshotDate,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(loanSnapshots.userId, userId), eq(loanSnapshots.id, existing.id)));
    return findByLoanAndMonth(userId, data.loanId, data.year, data.month) as Promise<LoanMonthlySnapshot>;
  }
  return create(userId, data);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(loanSnapshots).where(and(eq(loanSnapshots.userId, userId), eq(loanSnapshots.id, id)));
  return result.rowsAffected > 0;
}

export async function getAvailableYears(userId: string): Promise<number[]> {
  const rows = await findByUserId(userId);
  return [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);
}

export async function getAvailableMonths(userId: string, year: number): Promise<number[]> {
  const rows = await findByUserId(userId);
  return [...new Set(rows.filter((r) => r.year === year).map((r) => r.month))].sort((a, b) => a - b);
}
