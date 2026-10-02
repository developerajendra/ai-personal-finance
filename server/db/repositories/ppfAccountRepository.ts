import "server-only";
import { db, type Executor } from "@/server/db/client";
import { ppfAccounts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { PPFAccount } from "@/shared/types";

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

export async function findById(userId: string, id: string, exec: Executor = db): Promise<PPFAccount | null> {
  const rows = await exec.select().from(ppfAccounts).where(and(eq(ppfAccounts.userId, userId), eq(ppfAccounts.id, id))).limit(1);
  const [row] = rows;
  return row ? toAppModel(row) : null;
}

export async function create(userId: string, data: PPFAccount, exec: Executor = db): Promise<PPFAccount> {
  await exec.insert(ppfAccounts).values({
    ...data,
    userId,
    rawData: data.rawData ?? null,
  });
  return findById(userId, data.id, exec) as Promise<PPFAccount>;
}

export async function update(userId: string, id: string, data: Partial<PPFAccount>, exec: Executor = db): Promise<PPFAccount | null> {
  // Never let a caller-supplied id/userId reassign the row.
  const { id: _id, userId: _userId, ...rest } = data as Partial<PPFAccount> & { userId?: string };
  const result = await exec.update(ppfAccounts)
    .set({ ...rest, lastUpdated: new Date().toISOString(), rawData: rest.rawData ?? undefined })
    .where(and(eq(ppfAccounts.userId, userId), eq(ppfAccounts.id, id)));
  if (result.rowsAffected === 0) return null;
  return findById(userId, id, exec);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(ppfAccounts).where(and(eq(ppfAccounts.userId, userId), eq(ppfAccounts.id, id)));
  return result.rowsAffected > 0;
}
