import "server-only";
import * as repo from "@/server/db/repositories/budgetRepository";
import type { BudgetEntry, BudgetItem } from "@/shared/types";
import { budgetEntryInputSchema, budgetItemInputSchema, budgetItemUpdateSchema, monthKeySchema } from "@/shared/schemas/finance";
import { NotFoundError, ValidationError, clearedFields, newId, parseInput } from "@/server/finance/common";

/** All budget items plus the entries logged for one month. */
export async function getBudget(userId: string, month: unknown): Promise<{ items: BudgetItem[]; entries: BudgetEntry[] }> {
  const m = parseInput(monthKeySchema, month);
  const [items, entries] = await Promise.all([repo.findItems(userId), repo.findEntries(userId, m)]);
  return { items, entries };
}

export async function createBudgetItem(userId: string, input: unknown): Promise<BudgetItem> {
  const parsed = parseInput(budgetItemInputSchema, input);
  const now = new Date().toISOString();
  return repo.insertItem(userId, {
    ...parsed,
    dueMonth: parsed.frequency === "yearly" ? parsed.dueMonth : undefined,
    id: newId("bud"),
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateBudgetItem(userId: string, id: string, patch: unknown): Promise<BudgetItem> {
  const parsed = parseInput(budgetItemUpdateSchema, patch);
  const existing = await repo.findItem(userId, id);
  if (!existing) throw new NotFoundError("Budget item not found");
  const frequency = parsed.frequency ?? existing.frequency;
  const dueMonth = parsed.dueMonth ?? existing.dueMonth;
  if (frequency === "yearly" && dueMonth == null) throw new ValidationError("Pick the month a yearly item is due.");
  const cleared = clearedFields(patch, ["dueDay", "dueMonth", "paidFrom", "loanId", "notes"]);
  const updated = await repo.updateItem(userId, id, {
    ...parsed,
    ...cleared,
    ...(frequency === "monthly" ? { dueMonth: null } : {}),
  });
  if (!updated) throw new NotFoundError("Budget item not found");
  return updated;
}

export async function deleteBudgetItem(userId: string, id: string): Promise<void> {
  if (!(await repo.removeItem(userId, id))) throw new NotFoundError("Budget item not found");
}

export async function createBudgetEntry(userId: string, input: unknown): Promise<BudgetEntry> {
  const parsed = parseInput(budgetEntryInputSchema, input);
  // The item must belong to this user
  if (!(await repo.findItem(userId, parsed.itemId))) throw new NotFoundError("Budget item not found");
  return repo.insertEntry(userId, { ...parsed, id: newId("bent"), createdAt: new Date().toISOString() });
}

export async function deleteBudgetEntry(userId: string, id: string): Promise<void> {
  if (!(await repo.removeEntry(userId, id))) throw new NotFoundError("Budget entry not found");
}
