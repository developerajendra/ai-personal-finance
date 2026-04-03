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

export function findByUserId(userId: string): Property[] {
  return db.select().from(properties).where(eq(properties.userId, userId)).all().map(toAppModel);
}

export function findById(userId: string, id: string): Property | null {
  const [row] = db.select().from(properties).where(and(eq(properties.userId, userId), eq(properties.id, id))).limit(1).all();
  return row ? toAppModel(row) : null;
}

export function create(userId: string, data: Property): Property {
  db.insert(properties).values({ ...data, userId }).run();
  return findById(userId, data.id)!;
}

export function update(userId: string, id: string, data: Partial<Property>): Property | null {
  const existing = findById(userId, id);
  if (!existing) return null;
  db.update(properties).set({ ...data, updatedAt: new Date().toISOString() }).where(and(eq(properties.userId, userId), eq(properties.id, id))).run();
  return findById(userId, id);
}

export function remove(userId: string, id: string): boolean {
  return db.delete(properties).where(and(eq(properties.userId, userId), eq(properties.id, id))).run().changes > 0;
}

export function bulkCreate(userId: string, items: Property[]): void {
  for (const item of items) db.insert(properties).values({ ...item, userId }).run();
}

export function replaceAll(userId: string, items: Property[]): void {
  db.delete(properties).where(eq(properties.userId, userId)).run();
  bulkCreate(userId, items);
}
