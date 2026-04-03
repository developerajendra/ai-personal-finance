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

export function findByUserId(userId: string): PPFAccount[] {
  return db.select().from(ppfAccounts).where(eq(ppfAccounts.userId, userId)).all().map(toAppModel);
}

export function findById(userId: string, id: string): PPFAccount | null {
  const [row] = db.select().from(ppfAccounts).where(and(eq(ppfAccounts.userId, userId), eq(ppfAccounts.id, id))).limit(1).all();
  return row ? toAppModel(row) : null;
}

export function create(userId: string, data: PPFAccount): PPFAccount {
  db.insert(ppfAccounts).values({
    ...data,
    userId,
    rawData: data.rawData ?? null,
  }).run();
  return findById(userId, data.id)!;
}

export function update(userId: string, id: string, data: Partial<PPFAccount>): PPFAccount | null {
  const existing = findById(userId, id);
  if (!existing) return null;
  db.update(ppfAccounts)
    .set({ ...data, lastUpdated: new Date().toISOString(), rawData: data.rawData ?? undefined })
    .where(and(eq(ppfAccounts.userId, userId), eq(ppfAccounts.id, id)))
    .run();
  return findById(userId, id);
}

export function remove(userId: string, id: string): boolean {
  return db.delete(ppfAccounts).where(and(eq(ppfAccounts.userId, userId), eq(ppfAccounts.id, id))).run().changes > 0;
}

export function bulkCreate(userId: string, items: PPFAccount[]): void {
  for (const item of items) create(userId, item);
}
