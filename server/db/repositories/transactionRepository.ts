import "server-only";
import { db, type Executor } from "@/server/db/client";
import { transactions } from "@/server/db/schema";
import { eq, and, desc, inArray, isNotNull } from "drizzle-orm";
import type { Transaction } from "@/shared/types";
import { chunk, definedOnly } from "./helpers";

type TransactionRow = typeof transactions.$inferSelect;
export type TransactionValues = Omit<typeof transactions.$inferInsert, "userId">;

function toAppModel(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    amount: row.amount,
    description: row.description,
    category: row.category,
    type: row.type as Transaction["type"],
    balance: row.balance ?? undefined,
    account: row.account ?? undefined,
    source: row.source as Transaction["source"],
    sourceRef: row.sourceRef ?? undefined,
    qualityGrade: (row.qualityGrade as Transaction["qualityGrade"]) ?? undefined,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

export async function findByUserId(userId: string, exec: Executor = db): Promise<Transaction[]> {
  const rows = await exec
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string, exec: Executor = db): Promise<Transaction | null> {
  const [row] = await exec
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .limit(1);
  return row ? toAppModel(row) : null;
}

export async function findBySourceRef(
  userId: string,
  source: string,
  sourceRef: string,
  exec: Executor = db
): Promise<Transaction | null> {
  const [row] = await exec
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.source, source), eq(transactions.sourceRef, sourceRef)))
    .limit(1);
  return row ? toAppModel(row) : null;
}

/** Which of the given source refs already exist for this user and source. */
export async function existingSourceRefs(
  userId: string,
  source: string,
  refs: string[],
  exec: Executor = db
): Promise<Set<string>> {
  const found = new Set<string>();
  for (const part of chunk(refs, 200)) {
    const rows = await exec
      .select({ sourceRef: transactions.sourceRef })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.source, source),
          isNotNull(transactions.sourceRef),
          inArray(transactions.sourceRef, part)
        )
      );
    for (const r of rows) if (r.sourceRef) found.add(r.sourceRef);
  }
  return found;
}

export async function insert(userId: string, values: TransactionValues, exec: Executor = db): Promise<Transaction> {
  const [row] = await exec.insert(transactions).values({ ...values, userId }).returning();
  return toAppModel(row);
}

/**
 * Insert rows, skipping any that collide with the (user, source, sourceRef)
 * unique index. Returns the number of rows actually inserted.
 */
export async function insertManyIgnoringDuplicates(
  userId: string,
  items: TransactionValues[],
  exec: Executor = db
): Promise<number> {
  let inserted = 0;
  for (const part of chunk(items)) {
    const rows = await exec
      .insert(transactions)
      .values(part.map((v) => ({ ...v, userId })))
      .onConflictDoNothing()
      .returning({ id: transactions.id });
    inserted += rows.length;
  }
  return inserted;
}

export async function update(
  userId: string,
  id: string,
  values: Partial<TransactionValues>,
  exec: Executor = db
): Promise<Transaction | null> {
  const { id: _ignoredId, ...rest } = values;
  const [row] = await exec
    .update(transactions)
    .set({ ...definedOnly(rest), updatedAt: new Date().toISOString() })
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning();
  return row ? toAppModel(row) : null;
}

export async function remove(userId: string, id: string, exec: Executor = db): Promise<boolean> {
  const result = await exec.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, id)));
  return result.rowsAffected > 0;
}
