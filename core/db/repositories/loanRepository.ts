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

export async function findByUserId(userId: string): Promise<Loan[]> {
  const rows = await db.select().from(loans).where(eq(loans.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string): Promise<Loan | null> {
  const rows = await db.select().from(loans).where(and(eq(loans.userId, userId), eq(loans.id, id))).limit(1);
  const [row] = rows;
  return row ? toAppModel(row) : null;
}

export async function create(userId: string, data: Loan): Promise<Loan> {
  await db.insert(loans).values({ ...data, userId });
  return findById(userId, data.id) as Promise<Loan>;
}

export async function update(userId: string, id: string, data: Partial<Loan>): Promise<Loan | null> {
  const existing = await findById(userId, id);
  if (!existing) return null;
  await db.update(loans).set({ ...data, updatedAt: new Date().toISOString() }).where(and(eq(loans.userId, userId), eq(loans.id, id)));
  return findById(userId, id);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(loans).where(and(eq(loans.userId, userId), eq(loans.id, id)));
  return result.rowsAffected > 0;
}

export async function bulkCreate(userId: string, items: Loan[]): Promise<void> {
  for (const item of items) {
    await db.insert(loans).values({ ...item, userId });
  }
}

export async function replaceAll(userId: string, items: Loan[]): Promise<void> {
  await db.delete(loans).where(eq(loans.userId, userId));
  await bulkCreate(userId, items);
}
