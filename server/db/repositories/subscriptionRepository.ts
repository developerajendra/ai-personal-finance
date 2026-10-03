import "server-only";
import { db, type Executor } from "@/server/db/client";
import { subscriptions } from "@/server/db/schema";
import { eq, and, asc } from "drizzle-orm";
import type { Subscription } from "@/shared/types";
import { definedOnly } from "./helpers";

type SubscriptionRow = typeof subscriptions.$inferSelect;
export type SubscriptionValues = Omit<typeof subscriptions.$inferInsert, "userId">;

function toAppModel(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    plan: row.plan ?? undefined,
    category: row.category as Subscription["category"],
    amount: row.amount,
    currency: row.currency as Subscription["currency"],
    cycle: row.cycle as Subscription["cycle"],
    nextDate: row.nextDate,
    ends: row.ends,
    status: row.status as Subscription["status"],
    paidWith: row.paidWith ?? undefined,
    notes: row.notes ?? undefined,
    remind: row.remind,
    color: row.color ?? undefined,
    monogram: row.monogram ?? undefined,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

export async function findByUserId(userId: string, exec: Executor = db): Promise<Subscription[]> {
  const rows = await exec.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(asc(subscriptions.nextDate));
  return rows.map(toAppModel);
}

export async function insert(userId: string, values: SubscriptionValues, exec: Executor = db): Promise<Subscription> {
  const [row] = await exec.insert(subscriptions).values({ ...values, userId }).returning();
  return toAppModel(row);
}

export async function update(userId: string, id: string, values: Partial<SubscriptionValues>, exec: Executor = db): Promise<Subscription | null> {
  const { id: _ignoredId, ...rest } = values;
  const [row] = await exec
    .update(subscriptions)
    .set({ ...definedOnly(rest), updatedAt: new Date().toISOString() })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.id, id)))
    .returning();
  return row ? toAppModel(row) : null;
}

export async function remove(userId: string, id: string, exec: Executor = db): Promise<boolean> {
  const result = await exec.delete(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.id, id)));
  return result.rowsAffected > 0;
}
