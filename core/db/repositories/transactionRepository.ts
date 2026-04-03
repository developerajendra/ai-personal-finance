import { db } from "@/core/db";
import { transactions } from "@/core/db/schema";
import { eq, and } from "drizzle-orm";
import type { Transaction } from "@/core/types";

type TransactionRow = typeof transactions.$inferSelect;

function toAppModel(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    amount: row.amount,
    description: row.description,
    category: row.category,
    type: row.type as Transaction["type"],
    balance: row.balance ?? undefined,
    account: row.account ?? undefined,
    source: row.source as Transaction["source"],
    qualityGrade: (row.qualityGrade as Transaction["qualityGrade"]) ?? undefined,
  };
}

export function findByUserId(userId: string): Transaction[] {
  return db.select().from(transactions).where(eq(transactions.userId, userId)).all().map(toAppModel);
}

export function findById(userId: string, id: string): Transaction | null {
  const [row] = db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, id))).limit(1).all();
  return row ? toAppModel(row) : null;
}

export function create(userId: string, data: Transaction): Transaction {
  db.insert(transactions).values({ ...data, userId }).run();
  return findById(userId, data.id)!;
}

export function remove(userId: string, id: string): boolean {
  return db.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, id))).run().changes > 0;
}

export function bulkCreate(userId: string, items: Transaction[]): void {
  for (const item of items) db.insert(transactions).values({ ...item, userId }).run();
}

export function replaceAll(userId: string, items: Transaction[]): void {
  db.delete(transactions).where(eq(transactions.userId, userId)).run();
  bulkCreate(userId, items);
}
