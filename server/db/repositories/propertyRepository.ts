import "server-only";
import { db, type Executor } from "@/server/db/client";
import { properties } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { Property } from "@/shared/types";
import { chunk, definedOnly } from "./helpers";

type PropertyRow = typeof properties.$inferSelect;
export type PropertyValues = Omit<typeof properties.$inferInsert, "userId">;

function toAppModel(row: PropertyRow): Property {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Property["type"],
    assetType: (row.assetType as Property["assetType"]) ?? undefined,
    purchasePrice: row.purchasePrice,
    currentValue: row.currentValue ?? undefined,
    purchaseDate: row.purchaseDate,
    location: row.location,
    description: row.description ?? undefined,
    status: row.status as Property["status"],
    isPublished: row.isPublished,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

export async function findByUserId(userId: string, exec: Executor = db): Promise<Property[]> {
  const rows = await exec.select().from(properties).where(eq(properties.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string, exec: Executor = db): Promise<Property | null> {
  const [row] = await exec
    .select()
    .from(properties)
    .where(and(eq(properties.userId, userId), eq(properties.id, id)))
    .limit(1);
  return row ? toAppModel(row) : null;
}

export async function insert(userId: string, values: PropertyValues, exec: Executor = db): Promise<Property> {
  const [row] = await exec.insert(properties).values({ ...values, userId }).returning();
  return toAppModel(row);
}

export async function insertMany(userId: string, items: PropertyValues[], exec: Executor = db): Promise<number> {
  for (const part of chunk(items)) {
    await exec.insert(properties).values(part.map((v) => ({ ...v, userId })));
  }
  return items.length;
}

export async function update(
  userId: string,
  id: string,
  values: Partial<PropertyValues>,
  exec: Executor = db
): Promise<Property | null> {
  const { id: _ignoredId, ...rest } = values;
  const [row] = await exec
    .update(properties)
    .set({ ...definedOnly(rest), updatedAt: new Date().toISOString() })
    .where(and(eq(properties.userId, userId), eq(properties.id, id)))
    .returning();
  return row ? toAppModel(row) : null;
}

export async function remove(userId: string, id: string, exec: Executor = db): Promise<boolean> {
  const result = await exec.delete(properties).where(and(eq(properties.userId, userId), eq(properties.id, id)));
  return result.rowsAffected > 0;
}
