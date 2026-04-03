import { db } from "@/core/db";
import { bankBalances } from "@/core/db/schema";
import { eq, and } from "drizzle-orm";
import type { BankBalance } from "@/core/types";

type BankBalanceRow = typeof bankBalances.$inferSelect;

function toAppModel(row: BankBalanceRow): BankBalance {
  return {
    id: row.id,
    bankName: row.bankName,
    accountNumber: row.accountNumber ?? undefined,
    accountType: row.accountType as BankBalance["accountType"],
    assetType: (row.assetType as BankBalance["assetType"]) ?? undefined,
    balance: row.balance,
    currency: row.currency,
    originalAmount: row.originalAmount ?? undefined,
    originalCurrency: row.originalCurrency ?? undefined,
    lastUpdated: row.lastUpdated,
    description: row.description ?? undefined,
    status: row.status as BankBalance["status"],
    isPublished: row.isPublished,
    issueDate: row.issueDate ?? undefined,
    dueDate: row.dueDate ?? undefined,
    interestRate: row.interestRate ?? undefined,
    paidDate: row.paidDate ?? undefined,
    tags: row.tags ?? undefined,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

export async function findByUserId(userId: string): Promise<BankBalance[]> {
  const rows = await db.select().from(bankBalances).where(eq(bankBalances.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string): Promise<BankBalance | null> {
  const rows = await db.select().from(bankBalances).where(and(eq(bankBalances.userId, userId), eq(bankBalances.id, id))).limit(1);
  const [row] = rows;
  return row ? toAppModel(row) : null;
}

export async function create(userId: string, data: BankBalance): Promise<BankBalance> {
  await db.insert(bankBalances).values({ ...data, userId, tags: data.tags ?? null });
  return findById(userId, data.id) as Promise<BankBalance>;
}

export async function update(userId: string, id: string, data: Partial<BankBalance>): Promise<BankBalance | null> {
  const existing = await findById(userId, id);
  if (!existing) return null;
  await db.update(bankBalances).set({ ...data, tags: data.tags ?? undefined, updatedAt: new Date().toISOString() }).where(and(eq(bankBalances.userId, userId), eq(bankBalances.id, id)));
  return findById(userId, id);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(bankBalances).where(and(eq(bankBalances.userId, userId), eq(bankBalances.id, id)));
  return result.rowsAffected > 0;
}

export async function bulkCreate(userId: string, items: BankBalance[]): Promise<void> {
  for (const item of items) await db.insert(bankBalances).values({ ...item, userId, tags: item.tags ?? null });
}

export async function replaceAll(userId: string, items: BankBalance[]): Promise<void> {
  await db.delete(bankBalances).where(eq(bankBalances.userId, userId));
  await bulkCreate(userId, items);
}
