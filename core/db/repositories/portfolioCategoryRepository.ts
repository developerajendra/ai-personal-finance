import { db } from "@/core/db";
import { portfolioCategories } from "@/core/db/schema";
import { eq, and } from "drizzle-orm";
import type { PortfolioCategory } from "@/core/types";

type CategoryRow = typeof portfolioCategories.$inferSelect;

function toAppModel(row: CategoryRow): PortfolioCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon ?? undefined,
    href: row.href,
    type: row.type as PortfolioCategory["type"],
    description: row.description ?? undefined,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

export function findByUserId(userId: string): PortfolioCategory[] {
  return db.select().from(portfolioCategories).where(eq(portfolioCategories.userId, userId)).all().map(toAppModel);
}

export function findById(userId: string, id: string): PortfolioCategory | null {
  const [row] = db.select().from(portfolioCategories).where(and(eq(portfolioCategories.userId, userId), eq(portfolioCategories.id, id))).limit(1).all();
  return row ? toAppModel(row) : null;
}

export function create(userId: string, data: PortfolioCategory): PortfolioCategory {
  db.insert(portfolioCategories).values({ ...data, userId }).run();
  return findById(userId, data.id)!;
}

export function update(userId: string, id: string, data: Partial<PortfolioCategory>): PortfolioCategory | null {
  const existing = findById(userId, id);
  if (!existing) return null;
  db.update(portfolioCategories).set({ ...data, updatedAt: new Date().toISOString() }).where(and(eq(portfolioCategories.userId, userId), eq(portfolioCategories.id, id))).run();
  return findById(userId, id);
}

export function remove(userId: string, id: string): boolean {
  return db.delete(portfolioCategories).where(and(eq(portfolioCategories.userId, userId), eq(portfolioCategories.id, id))).run().changes > 0;
}

export function replaceAll(userId: string, items: PortfolioCategory[]): void {
  db.delete(portfolioCategories).where(eq(portfolioCategories.userId, userId)).run();
  for (const item of items) db.insert(portfolioCategories).values({ ...item, userId }).run();
}
