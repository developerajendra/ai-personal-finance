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

export function findByUserId(userId: string): LoanMonthlySnapshot[] {
  return db.select().from(loanSnapshots).where(eq(loanSnapshots.userId, userId)).all().map(toAppModel);
}

export function findByLoanId(userId: string, loanId: string): LoanMonthlySnapshot[] {
  return db
    .select()
    .from(loanSnapshots)
    .where(and(eq(loanSnapshots.userId, userId), eq(loanSnapshots.loanId, loanId)))
    .all()
    .map(toAppModel)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

export function findByLoanAndMonth(userId: string, loanId: string, year: number, month: number): LoanMonthlySnapshot | null {
  const [row] = db
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
    .limit(1)
    .all();
  return row ? toAppModel(row) : null;
}

export function findByMonth(userId: string, year: number, month: number): LoanMonthlySnapshot[] {
  return db
    .select()
    .from(loanSnapshots)
    .where(and(eq(loanSnapshots.userId, userId), eq(loanSnapshots.year, year), eq(loanSnapshots.month, month)))
    .all()
    .map(toAppModel);
}

export function findByYear(userId: string, loanId: string, year: number): LoanMonthlySnapshot[] {
  return db
    .select()
    .from(loanSnapshots)
    .where(and(eq(loanSnapshots.userId, userId), eq(loanSnapshots.loanId, loanId), eq(loanSnapshots.year, year)))
    .all()
    .map(toAppModel)
    .sort((a, b) => a.month - b.month);
}

export function findLatest(userId: string, loanId: string): LoanMonthlySnapshot | null {
  const all = findByLoanId(userId, loanId);
  return all.length > 0 ? all[all.length - 1] : null;
}

export function create(userId: string, data: LoanMonthlySnapshot): LoanMonthlySnapshot {
  db.insert(loanSnapshots).values({ ...data, userId }).run();
  return findByLoanAndMonth(userId, data.loanId, data.year, data.month)!;
}

export function upsert(userId: string, data: LoanMonthlySnapshot): LoanMonthlySnapshot {
  const existing = findByLoanAndMonth(userId, data.loanId, data.year, data.month);
  if (existing) {
    db.update(loanSnapshots)
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
      .where(and(eq(loanSnapshots.userId, userId), eq(loanSnapshots.id, existing.id)))
      .run();
    return findByLoanAndMonth(userId, data.loanId, data.year, data.month)!;
  }
  return create(userId, data);
}

export function remove(userId: string, id: string): boolean {
  return db.delete(loanSnapshots).where(and(eq(loanSnapshots.userId, userId), eq(loanSnapshots.id, id))).run().changes > 0;
}

export function getAvailableYears(userId: string): number[] {
  const rows = findByUserId(userId);
  return [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);
}

export function getAvailableMonths(userId: string, year: number): number[] {
  const rows = findByUserId(userId).filter((r) => r.year === year);
  return [...new Set(rows.map((r) => r.month))].sort((a, b) => a - b);
}
