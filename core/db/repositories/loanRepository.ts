import { db } from "@/core/db";
import { loans } from "@/core/db/schema";
import { eq, and } from "drizzle-orm";
import type { Loan } from "@/core/types";

type LoanRow = typeof loans.$inferSelect;

function toAppModel(row: LoanRow): Loan {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Loan["type"],
    principalAmount: row.principalAmount,
    outstandingAmount: row.outstandingAmount,
    interestRate: row.interestRate,
    startDate: row.startDate,
    endDate: row.endDate ?? undefined,
    emiAmount: row.emiAmount,
    emiDate: row.emiDate,
    tenureMonths: row.tenureMonths,
    description: row.description ?? undefined,
    status: row.status as Loan["status"],
    isPublished: row.isPublished,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

export function findByUserId(userId: string): Loan[] {
  return db.select().from(loans).where(eq(loans.userId, userId)).all().map(toAppModel);
}

export function findById(userId: string, id: string): Loan | null {
  const [row] = db.select().from(loans).where(and(eq(loans.userId, userId), eq(loans.id, id))).limit(1).all();
  return row ? toAppModel(row) : null;
}

export function create(userId: string, data: Loan): Loan {
  db.insert(loans).values({ ...data, userId }).run();
  return findById(userId, data.id)!;
}

export function update(userId: string, id: string, data: Partial<Loan>): Loan | null {
  const existing = findById(userId, id);
  if (!existing) return null;
  db.update(loans).set({ ...data, updatedAt: new Date().toISOString() }).where(and(eq(loans.userId, userId), eq(loans.id, id))).run();
  return findById(userId, id);
}

export function remove(userId: string, id: string): boolean {
  return db.delete(loans).where(and(eq(loans.userId, userId), eq(loans.id, id))).run().changes > 0;
}

export function bulkCreate(userId: string, items: Loan[]): void {
  for (const item of items) {
    db.insert(loans).values({ ...item, userId }).run();
  }
}

export function replaceAll(userId: string, items: Loan[]): void {
  db.delete(loans).where(eq(loans.userId, userId)).run();
  bulkCreate(userId, items);
}
