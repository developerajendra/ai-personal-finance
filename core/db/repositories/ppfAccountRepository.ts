import { db } from "@/core/db";
import { ppfAccounts } from "@/core/db/schema";
import { eq, and } from "drizzle-orm";
import type { PPFAccount } from "@/core/services/ppfStorageService";

type PPFRow = typeof ppfAccounts.$inferSelect;

function toAppModel(row: PPFRow): PPFAccount {
  return {
    id: row.id,
    memberId: row.memberId ?? undefined,
    memberName: row.memberName ?? undefined,
    establishmentId: row.establishmentId ?? undefined,
    establishmentName: row.establishmentName ?? undefined,
    depositEmployeeShare: row.depositEmployeeShare,
    depositEmployerShare: row.depositEmployerShare,
    withdrawEmployeeShare: row.withdrawEmployeeShare,
    withdrawEmployerShare: row.withdrawEmployerShare,
    pensionContribution: row.pensionContribution,
    grandTotal: row.grandTotal,
    extractedFrom: row.extractedFrom ?? undefined,
    extractedAt: row.extractedAt ?? new Date().toISOString(),
    lastUpdated: row.lastUpdated ?? undefined,
    rawData: row.rawData ?? undefined,
  };
}

export async function findByUserId(userId: string): Promise<PPFAccount[]> {
  const rows = await db.select().from(ppfAccounts).where(eq(ppfAccounts.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string): Promise<PPFAccount | null> {
  const rows = await db.select().from(ppfAccounts).where(and(eq(ppfAccounts.userId, userId), eq(ppfAccounts.id, id))).limit(1);
  const [row] = rows;
  return row ? toAppModel(row) : null;
}

export async function create(userId: string, data: PPFAccount): Promise<PPFAccount> {
  await db.insert(ppfAccounts).values({
    ...data,
    userId,
    rawData: data.rawData ?? null,
  });
  return findById(userId, data.id) as Promise<PPFAccount>;
}

export async function update(userId: string, id: string, data: Partial<PPFAccount>): Promise<PPFAccount | null> {
  const existing = await findById(userId, id);
  if (!existing) return null;
  await db.update(ppfAccounts)
    .set({ ...data, lastUpdated: new Date().toISOString(), rawData: data.rawData ?? undefined })
    .where(and(eq(ppfAccounts.userId, userId), eq(ppfAccounts.id, id)));
  return findById(userId, id);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(ppfAccounts).where(and(eq(ppfAccounts.userId, userId), eq(ppfAccounts.id, id)));
  return result.rowsAffected > 0;
}

export async function bulkCreate(userId: string, items: PPFAccount[]): Promise<void> {
  for (const item of items) await create(userId, item);
}
