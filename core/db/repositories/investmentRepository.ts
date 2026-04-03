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

export function findByUserId(userId: string): Investment[] {
  const rows = db.select().from(investments).where(eq(investments.userId, userId)).all();
  return rows.map(toAppModel);
}

export function findById(userId: string, id: string): Investment | null {
  const [row] = db
    .select()
    .from(investments)
    .where(and(eq(investments.userId, userId), eq(investments.id, id)))
    .limit(1)
    .all();
  return row ? toAppModel(row) : null;
}

export function create(userId: string, data: Investment): Investment {
  db.insert(investments)
    .values({ ...data, userId, tags: data.tags ?? null })
    .run();
  return findById(userId, data.id)!;
}

export function update(userId: string, id: string, data: Partial<Investment>): Investment | null {
  const existing = findById(userId, id);
  if (!existing) return null;

  const now = new Date().toISOString();
  db.update(investments)
    .set({ ...data, tags: data.tags ?? undefined, updatedAt: now })
    .where(and(eq(investments.userId, userId), eq(investments.id, id)))
    .run();
  return findById(userId, id);
}

export function remove(userId: string, id: string): boolean {
  const result = db
    .delete(investments)
    .where(and(eq(investments.userId, userId), eq(investments.id, id)))
    .run();
  return result.changes > 0;
}

export function bulkCreate(userId: string, items: Investment[]): void {
  for (const item of items) {
    db.insert(investments)
      .values({ ...item, userId, tags: item.tags ?? null })
      .run();
  }
}

export function replaceAll(userId: string, items: Investment[]): void {
  db.delete(investments).where(eq(investments.userId, userId)).run();
  bulkCreate(userId, items);
}
