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

export function findByUserId(userId: string): BankBalance[] {
  return db.select().from(bankBalances).where(eq(bankBalances.userId, userId)).all().map(toAppModel);
}

export function findById(userId: string, id: string): BankBalance | null {
  const [row] = db.select().from(bankBalances).where(and(eq(bankBalances.userId, userId), eq(bankBalances.id, id))).limit(1).all();
  return row ? toAppModel(row) : null;
}

export function create(userId: string, data: BankBalance): BankBalance {
  db.insert(bankBalances).values({ ...data, userId, tags: data.tags ?? null }).run();
  return findById(userId, data.id)!;
}

export function update(userId: string, id: string, data: Partial<BankBalance>): BankBalance | null {
  const existing = findById(userId, id);
  if (!existing) return null;
  db.update(bankBalances).set({ ...data, tags: data.tags ?? undefined, updatedAt: new Date().toISOString() }).where(and(eq(bankBalances.userId, userId), eq(bankBalances.id, id))).run();
  return findById(userId, id);
}

export function remove(userId: string, id: string): boolean {
  return db.delete(bankBalances).where(and(eq(bankBalances.userId, userId), eq(bankBalances.id, id))).run().changes > 0;
}

export function bulkCreate(userId: string, items: BankBalance[]): void {
  for (const item of items) db.insert(bankBalances).values({ ...item, userId, tags: item.tags ?? null }).run();
}

export function replaceAll(userId: string, items: BankBalance[]): void {
  db.delete(bankBalances).where(eq(bankBalances.userId, userId)).run();
  bulkCreate(userId, items);
}
