import { db } from "@/core/db";
import { properties } from "@/core/db/schema";
import { eq, and } from "drizzle-orm";
import type { Property } from "@/core/types";

type PropertyRow = typeof properties.$inferSelect;

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

export async function findByUserId(userId: string): Promise<Property[]> {
  const rows = await db.select().from(properties).where(eq(properties.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string): Promise<Property | null> {
  const rows = await db.select().from(properties).where(and(eq(properties.userId, userId), eq(properties.id, id))).limit(1);
  const [row] = rows;
  return row ? toAppModel(row) : null;
}

export async function create(userId: string, data: Property): Promise<Property> {
  await db.insert(properties).values({ ...data, userId });
  return findById(userId, data.id) as Promise<Property>;
}

export async function update(userId: string, id: string, data: Partial<Property>): Promise<Property | null> {
  const existing = await findById(userId, id);
  if (!existing) return null;
  await db.update(properties).set({ ...data, updatedAt: new Date().toISOString() }).where(and(eq(properties.userId, userId), eq(properties.id, id)));
  return findById(userId, id);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(properties).where(and(eq(properties.userId, userId), eq(properties.id, id)));
  return result.rowsAffected > 0;
}

export async function bulkCreate(userId: string, items: Property[]): Promise<void> {
  for (const item of items) await db.insert(properties).values({ ...item, userId });
}

export async function replaceAll(userId: string, items: Property[]): Promise<void> {
  await db.delete(properties).where(eq(properties.userId, userId));
  await bulkCreate(userId, items);
}
