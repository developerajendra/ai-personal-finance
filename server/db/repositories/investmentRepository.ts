import "server-only";
import { db, type Executor } from "@/server/db/client";
import { investments } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { Investment } from "@/shared/types";
import { chunk, definedOnly } from "./helpers";

type InvestmentRow = typeof investments.$inferSelect;
export type InvestmentValues = Omit<typeof investments.$inferInsert, "userId">;

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
    compoundingMonths: row.compoundingMonths ?? undefined,
    ruleLabel: row.ruleLabel ?? undefined,
    ruleFormula: row.ruleFormula ?? undefined,
    description: row.description ?? undefined,
    status: row.status as Investment["status"],
    isPublished: row.isPublished,
    tags: row.tags ?? undefined,
    source: row.source ?? undefined,
    sourceRef: row.sourceRef ?? undefined,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

export async function findByUserId(userId: string, exec: Executor = db): Promise<Investment[]> {
  const rows = await exec.select().from(investments).where(eq(investments.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string, exec: Executor = db): Promise<Investment | null> {
  const [row] = await exec
    .select()
    .from(investments)
    .where(and(eq(investments.userId, userId), eq(investments.id, id)))
    .limit(1);
  return row ? toAppModel(row) : null;
}

export async function findBySourceRef(
  userId: string,
  source: string,
  sourceRef: string,
  exec: Executor = db
): Promise<Investment | null> {
  const [row] = await exec
    .select()
    .from(investments)
    .where(and(eq(investments.userId, userId), eq(investments.source, source), eq(investments.sourceRef, sourceRef)))
    .limit(1);
  return row ? toAppModel(row) : null;
}

export async function insert(userId: string, values: InvestmentValues, exec: Executor = db): Promise<Investment> {
  const [row] = await exec.insert(investments).values({ ...values, userId }).returning();
  return toAppModel(row);
}

export async function insertMany(userId: string, items: InvestmentValues[], exec: Executor = db): Promise<number> {
  for (const part of chunk(items)) {
    await exec.insert(investments).values(part.map((v) => ({ ...v, userId })));
  }
  return items.length;
}

export async function update(
  userId: string,
  id: string,
  values: Partial<InvestmentValues>,
  exec: Executor = db
): Promise<Investment | null> {
  const { id: _ignoredId, ...rest } = values;
  const [row] = await exec
    .update(investments)
    .set({ ...definedOnly(rest), updatedAt: new Date().toISOString() })
    .where(and(eq(investments.userId, userId), eq(investments.id, id)))
    .returning();
  return row ? toAppModel(row) : null;
}

export async function remove(userId: string, id: string, exec: Executor = db): Promise<boolean> {
  const result = await exec
    .delete(investments)
    .where(and(eq(investments.userId, userId), eq(investments.id, id)));
  return result.rowsAffected > 0;
}
