import "server-only";
import { db, type Executor } from "@/server/db/client";
import { bankBalances } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { BankBalance } from "@/shared/types";
import { chunk, definedOnly } from "./helpers";

type BankBalanceRow = typeof bankBalances.$inferSelect;
export type BankBalanceValues = Omit<typeof bankBalances.$inferInsert, "userId">;

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

export async function findByUserId(userId: string, exec: Executor = db): Promise<BankBalance[]> {
  const rows = await exec.select().from(bankBalances).where(eq(bankBalances.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string, exec: Executor = db): Promise<BankBalance | null> {
  const [row] = await exec
    .select()
    .from(bankBalances)
    .where(and(eq(bankBalances.userId, userId), eq(bankBalances.id, id)))
    .limit(1);
  return row ? toAppModel(row) : null;
}

export async function insert(userId: string, values: BankBalanceValues, exec: Executor = db): Promise<BankBalance> {
  const [row] = await exec.insert(bankBalances).values({ ...values, userId }).returning();
  return toAppModel(row);
}

export async function insertMany(userId: string, items: BankBalanceValues[], exec: Executor = db): Promise<number> {
  for (const part of chunk(items)) {
    await exec.insert(bankBalances).values(part.map((v) => ({ ...v, userId })));
  }
  return items.length;
}

export async function update(
  userId: string,
  id: string,
  values: Partial<BankBalanceValues>,
  exec: Executor = db
): Promise<BankBalance | null> {
  const { id: _ignoredId, ...rest } = values;
  const [row] = await exec
    .update(bankBalances)
    .set({ ...definedOnly(rest), updatedAt: new Date().toISOString() })
    .where(and(eq(bankBalances.userId, userId), eq(bankBalances.id, id)))
    .returning();
  return row ? toAppModel(row) : null;
}

export async function remove(userId: string, id: string, exec: Executor = db): Promise<boolean> {
  const result = await exec.delete(bankBalances).where(and(eq(bankBalances.userId, userId), eq(bankBalances.id, id)));
  return result.rowsAffected > 0;
}
