import "server-only";
import { db, type Executor } from "@/server/db/client";
import { loans } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { Loan } from "@/shared/types";
import { chunk, definedOnly } from "./helpers";

type LoanRow = typeof loans.$inferSelect;
export type LoanValues = Omit<typeof loans.$inferInsert, "userId">;

function toAppModel(row: LoanRow): Loan {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Loan["type"],
    principalAmount: row.principalAmount,
    outstandingAmount: row.outstandingAmount,
    interestRate: row.interestRate,
    startDate: row.startDate,
    endDate: row.endDate ?? undefined,
    emiAmount: row.emiAmount,
    emiDate: row.emiDate,
    tenureMonths: row.tenureMonths,
    description: row.description ?? undefined,
    status: row.status as Loan["status"],
    isPublished: row.isPublished,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

export async function findByUserId(userId: string, exec: Executor = db): Promise<Loan[]> {
  const rows = await exec.select().from(loans).where(eq(loans.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string, exec: Executor = db): Promise<Loan | null> {
  const [row] = await exec
    .select()
    .from(loans)
    .where(and(eq(loans.userId, userId), eq(loans.id, id)))
    .limit(1);
  return row ? toAppModel(row) : null;
}

export async function insert(userId: string, values: LoanValues, exec: Executor = db): Promise<Loan> {
  const [row] = await exec.insert(loans).values({ ...values, userId }).returning();
  return toAppModel(row);
}

export async function insertMany(userId: string, items: LoanValues[], exec: Executor = db): Promise<number> {
  for (const part of chunk(items)) {
    await exec.insert(loans).values(part.map((v) => ({ ...v, userId })));
  }
  return items.length;
}

export async function update(
  userId: string,
  id: string,
  values: Partial<LoanValues>,
  exec: Executor = db
): Promise<Loan | null> {
  const { id: _ignoredId, ...rest } = values;
  const [row] = await exec
    .update(loans)
    .set({ ...definedOnly(rest), updatedAt: new Date().toISOString() })
    .where(and(eq(loans.userId, userId), eq(loans.id, id)))
    .returning();
  return row ? toAppModel(row) : null;
}

export async function remove(userId: string, id: string, exec: Executor = db): Promise<boolean> {
  const result = await exec.delete(loans).where(and(eq(loans.userId, userId), eq(loans.id, id)));
  return result.rowsAffected > 0;
}
