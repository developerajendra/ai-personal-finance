import "server-only";
import { db, type Executor } from "@/server/db/client";
import { budgetEntries, budgetItems } from "@/server/db/schema";
import { and, asc, eq } from "drizzle-orm";
import type { BudgetEntry, BudgetItem } from "@/shared/types";
import { definedOnly } from "./helpers";

type ItemRow = typeof budgetItems.$inferSelect;
type EntryRow = typeof budgetEntries.$inferSelect;
export type BudgetItemValues = Omit<typeof budgetItems.$inferInsert, "userId">;
export type BudgetEntryValues = Omit<typeof budgetEntries.$inferInsert, "userId">;

function toItem(row: ItemRow): BudgetItem {
  return {
    id: row.id,
    kind: row.kind as BudgetItem["kind"],
    name: row.name,
    category: row.category,
    costType: row.costType as BudgetItem["costType"],
    frequency: row.frequency as BudgetItem["frequency"],
    amount: row.amount,
    dueDay: row.dueDay ?? undefined,
    dueMonth: row.dueMonth ?? undefined,
    paidFrom: row.paidFrom ?? undefined,
    loanId: row.loanId ?? undefined,
    notes: row.notes ?? undefined,
    active: row.active,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

function toEntry(row: EntryRow): BudgetEntry {
  return {
    id: row.id,
    itemId: row.itemId,
    month: row.month,
    amount: row.amount,
    date: row.date,
    note: row.note ?? undefined,
    createdAt: row.createdAt ?? new Date().toISOString(),
  };
}

export async function findItems(userId: string, exec: Executor = db): Promise<BudgetItem[]> {
  const rows = await exec.select().from(budgetItems).where(eq(budgetItems.userId, userId)).orderBy(asc(budgetItems.createdAt));
  return rows.map(toItem);
}

export async function findItem(userId: string, id: string, exec: Executor = db): Promise<BudgetItem | null> {
  const [row] = await exec.select().from(budgetItems).where(and(eq(budgetItems.userId, userId), eq(budgetItems.id, id)));
  return row ? toItem(row) : null;
}

export async function insertItem(userId: string, values: BudgetItemValues, exec: Executor = db): Promise<BudgetItem> {
  const [row] = await exec.insert(budgetItems).values({ ...values, userId }).returning();
  return toItem(row);
}

export async function updateItem(userId: string, id: string, values: Partial<BudgetItemValues>, exec: Executor = db): Promise<BudgetItem | null> {
  const { id: _ignoredId, ...rest } = values;
  const [row] = await exec
    .update(budgetItems)
    .set({ ...definedOnly(rest), updatedAt: new Date().toISOString() })
    .where(and(eq(budgetItems.userId, userId), eq(budgetItems.id, id)))
    .returning();
  return row ? toItem(row) : null;
}

export async function removeItem(userId: string, id: string, exec: Executor = db): Promise<boolean> {
  // Entries go with the item (ON DELETE CASCADE); delete them explicitly too in case FKs are off
  await exec.delete(budgetEntries).where(and(eq(budgetEntries.userId, userId), eq(budgetEntries.itemId, id)));
  const result = await exec.delete(budgetItems).where(and(eq(budgetItems.userId, userId), eq(budgetItems.id, id)));
  return result.rowsAffected > 0;
}

export async function findEntries(userId: string, month: string, exec: Executor = db): Promise<BudgetEntry[]> {
  const rows = await exec
    .select()
    .from(budgetEntries)
    .where(and(eq(budgetEntries.userId, userId), eq(budgetEntries.month, month)))
    .orderBy(asc(budgetEntries.date));
  return rows.map(toEntry);
}

/** Every logged entry across all months, oldest first (used by the full export). */
export async function findAllEntries(userId: string, exec: Executor = db): Promise<BudgetEntry[]> {
  const rows = await exec.select().from(budgetEntries).where(eq(budgetEntries.userId, userId)).orderBy(asc(budgetEntries.date));
  return rows.map(toEntry);
}

export async function insertEntry(userId: string, values: BudgetEntryValues, exec: Executor = db): Promise<BudgetEntry> {
  const [row] = await exec.insert(budgetEntries).values({ ...values, userId }).returning();
  return toEntry(row);
}

export async function removeEntry(userId: string, id: string, exec: Executor = db): Promise<boolean> {
  const result = await exec.delete(budgetEntries).where(and(eq(budgetEntries.userId, userId), eq(budgetEntries.id, id)));
  return result.rowsAffected > 0;
}
