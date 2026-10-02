import "server-only";
import { createHash } from "crypto";
import { db, type Executor } from "@/server/db/client";
import * as transactionRepo from "@/server/db/repositories/transactionRepository";
import { isUniqueConstraintError } from "@/server/db/repositories/helpers";
import { transactionInputSchema, transactionUpdateSchema } from "@/shared/schemas/finance";
import type { FinancialSummary, Transaction } from "@/shared/types";
import { fromPaise, toPaise } from "@/shared/utils/money";
import {
  ConflictError,
  NotFoundError,
  clearedFields,
  newId,
  parseInput,
  type SourceIdentity,
} from "@/server/finance/common";

export interface TransactionFilters {
  from?: string;
  to?: string;
  type?: Transaction["type"];
  category?: string;
}

export async function listTransactions(userId: string, filters: TransactionFilters = {}): Promise<Transaction[]> {
  const all = await transactionRepo.findByUserId(userId);
  return all.filter((t) => {
    if (filters.type && t.type !== filters.type) return false;
    if (filters.category && t.category !== filters.category) return false;
    if (filters.from && t.date.slice(0, 10) < filters.from.slice(0, 10)) return false;
    if (filters.to && t.date.slice(0, 10) > filters.to.slice(0, 10)) return false;
    return true;
  });
}

export function getTransaction(userId: string, id: string): Promise<Transaction | null> {
  return transactionRepo.findById(userId, id);
}

function prepare(input: unknown, identity?: SourceIdentity): transactionRepo.TransactionValues {
  const parsed = parseInput(transactionInputSchema, input);
  return {
    ...parsed,
    id: parsed.id ?? newId("txn"),
    source: identity?.source ?? parsed.source,
    sourceRef: identity?.sourceRef ?? null,
    createdAt: new Date().toISOString(),
  };
}

export async function createTransaction(userId: string, input: unknown, exec: Executor = db): Promise<Transaction> {
  try {
    return await transactionRepo.insert(userId, prepare(input), exec);
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new ConflictError("A transaction with this id already exists");
    throw error;
  }
}

/**
 * Record a transaction exactly once per source identity. Two separate
 * messages with identical amount/date create two rows (different refs); a
 * retried delivery of the same message returns the original row.
 */
export async function createTransactionOnce(
  userId: string,
  input: unknown,
  identity: SourceIdentity
): Promise<{ transaction: Transaction; created: boolean }> {
  const existing = await transactionRepo.findBySourceRef(userId, identity.source, identity.sourceRef);
  if (existing) return { transaction: existing, created: false };
  try {
    return { transaction: await transactionRepo.insert(userId, prepare(input, identity)), created: true };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const winner = await transactionRepo.findBySourceRef(userId, identity.source, identity.sourceRef);
      if (winner) return { transaction: winner, created: false };
    }
    throw error;
  }
}

export async function updateTransaction(userId: string, id: string, patch: unknown): Promise<Transaction> {
  const parsed = parseInput(transactionUpdateSchema, patch);
  const updated = await transactionRepo.update(userId, id, {
    ...parsed,
    ...clearedFields(patch, ["balance", "account", "qualityGrade"]),
  });
  if (!updated) throw new NotFoundError("Transaction");
  return updated;
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  if (!(await transactionRepo.remove(userId, id))) throw new NotFoundError("Transaction");
}

/**
 * Fingerprint an imported row so re-importing the same statement is a no-op.
 * `occurrence` distinguishes genuinely repeated identical rows within one
 * file (e.g. two ₹500 transfers on the same day).
 */
export function importFingerprint(
  row: { date: string; amount: number; description: string; type: string },
  occurrence: number
): string {
  const day = row.date.slice(0, 10);
  const key = [day, toPaise(row.amount), row.type, row.description.trim().toLowerCase(), occurrence].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

/**
 * Add imported transactions without touching existing rows. Rows already
 * imported from the same source (same fingerprint) are skipped.
 */
export async function importTransactions(
  userId: string,
  source: Transaction["source"],
  rows: unknown[],
  exec: Executor = db
): Promise<{ inserted: number; skipped: number }> {
  const seen = new Map<string, number>();
  const values = rows.map((row) => {
    const parsed = parseInput(transactionInputSchema, row);
    const base = importFingerprint(parsed, 0);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return {
      ...parsed,
      id: newId("txn"),
      source,
      sourceRef: importFingerprint(parsed, occurrence),
      createdAt: new Date().toISOString(),
    };
  });
  const inserted = await transactionRepo.insertManyIgnoringDuplicates(userId, values, exec);
  return { inserted, skipped: values.length - inserted };
}

/** Income/expense totals computed in integer paise. */
export function summarizeTransactions(transactions: Transaction[]): FinancialSummary {
  let income = 0;
  let expenses = 0;
  const byCategory = new Map<string, number>();
  for (const t of transactions) {
    const paise = toPaise(t.amount);
    if (t.type === "credit") income += paise;
    else expenses += paise;
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + paise);
  }
  return {
    totalIncome: fromPaise(income),
    totalExpenses: fromPaise(expenses),
    netBalance: fromPaise(income - expenses),
    categoryBreakdown: Object.fromEntries([...byCategory].map(([k, v]) => [k, fromPaise(v)])),
  };
}

export async function getFinancialSummary(userId: string, filters: TransactionFilters = {}): Promise<FinancialSummary> {
  return summarizeTransactions(await listTransactions(userId, filters));
}
