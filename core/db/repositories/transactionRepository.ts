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
    frequency: (row.frequency as Transaction["frequency"]) ?? undefined,
    balance: row.balance ?? undefined,
    account: row.account ?? undefined,
    source: row.source as Transaction["source"],
    qualityGrade: (row.qualityGrade as Transaction["qualityGrade"]) ?? undefined,
  };
}

export async function findByUserId(userId: string): Promise<Transaction[]> {
  const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string): Promise<Transaction | null> {
  const rows = await db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, id))).limit(1);
  const [row] = rows;
  return row ? toAppModel(row) : null;
}

export async function create(userId: string, data: Transaction): Promise<Transaction> {
  await db.insert(transactions).values({ ...data, userId });
  return findById(userId, data.id) as Promise<Transaction>;
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, id)));
  return result.rowsAffected > 0;
}

export async function bulkCreate(userId: string, items: Transaction[]): Promise<void> {
  for (const item of items) await db.insert(transactions).values({ ...item, userId });
}

export async function replaceAll(userId: string, items: Transaction[]): Promise<void> {
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await bulkCreate(userId, items);
}
