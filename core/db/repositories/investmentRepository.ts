import { db } from "@/core/db";
import { investments } from "@/core/db/schema";
import { eq, and } from "drizzle-orm";
import type { Investment } from "@/core/types";

type InvestmentRow = typeof investments.$inferSelect;

function toAppModel(row: InvestmentRow): Investment {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    currency: row.currency ?? undefined,
    originalAmount: row.originalAmount ?? undefined,
    originalCurrency: row.originalCurrency ?? undefined,
    type: row.type as Investment["type"],
    assetType: (row.assetType as Investment["assetType"]) ?? undefined,
    startDate: row.startDate,
    endDate: row.endDate ?? undefined,
    maturityDate: row.maturityDate ?? undefined,
    maturityAmount: row.maturityAmount ?? undefined,
    originalMaturityAmount: row.originalMaturityAmount ?? undefined,
    interestRate: row.interestRate ?? undefined,
    ruleLabel: row.ruleLabel ?? undefined,
    ruleFormula: row.ruleFormula ?? undefined,
    description: row.description ?? undefined,
    status: row.status as Investment["status"],
    isPublished: row.isPublished,
    tags: row.tags ?? undefined,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

export async function findByUserId(userId: string): Promise<Investment[]> {
  const rows = await db.select().from(investments).where(eq(investments.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string): Promise<Investment | null> {
  const rows = await db
    .select()
    .from(investments)
    .where(and(eq(investments.userId, userId), eq(investments.id, id)))
    .limit(1);
  const [row] = rows;
  return row ? toAppModel(row) : null;
}

export async function create(userId: string, data: Investment): Promise<Investment> {
  await db.insert(investments)
    .values({ ...data, userId, tags: data.tags ?? null });
  return findById(userId, data.id) as Promise<Investment>;
}

export async function update(userId: string, id: string, data: Partial<Investment>): Promise<Investment | null> {
  const existing = await findById(userId, id);
  if (!existing) return null;

  const now = new Date().toISOString();
  await db.update(investments)
    .set({ ...data, tags: data.tags ?? undefined, updatedAt: now })
    .where(and(eq(investments.userId, userId), eq(investments.id, id)));
  return findById(userId, id);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(investments)
    .where(and(eq(investments.userId, userId), eq(investments.id, id)));
  return result.rowsAffected > 0;
}

export async function bulkCreate(userId: string, items: Investment[]): Promise<void> {
  for (const item of items) {
    await db.insert(investments)
      .values({ ...item, userId, tags: item.tags ?? null });
  }
}

export async function replaceAll(userId: string, items: Investment[]): Promise<void> {
  await db.delete(investments).where(eq(investments.userId, userId));
  await bulkCreate(userId, items);
}
