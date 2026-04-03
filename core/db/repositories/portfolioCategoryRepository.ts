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

export async function findByUserId(userId: string): Promise<PortfolioCategory[]> {
  const rows = await db.select().from(portfolioCategories).where(eq(portfolioCategories.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string): Promise<PortfolioCategory | null> {
  const rows = await db.select().from(portfolioCategories).where(and(eq(portfolioCategories.userId, userId), eq(portfolioCategories.id, id))).limit(1);
  const [row] = rows;
  return row ? toAppModel(row) : null;
}

export async function create(userId: string, data: PortfolioCategory): Promise<PortfolioCategory> {
  await db.insert(portfolioCategories).values({ ...data, userId });
  return findById(userId, data.id) as Promise<PortfolioCategory>;
}

export async function update(userId: string, id: string, data: Partial<PortfolioCategory>): Promise<PortfolioCategory | null> {
  const existing = await findById(userId, id);
  if (!existing) return null;
  await db.update(portfolioCategories).set({ ...data, updatedAt: new Date().toISOString() }).where(and(eq(portfolioCategories.userId, userId), eq(portfolioCategories.id, id)));
  return findById(userId, id);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const result = await db.delete(portfolioCategories).where(and(eq(portfolioCategories.userId, userId), eq(portfolioCategories.id, id)));
  return result.rowsAffected > 0;
}

export async function replaceAll(userId: string, items: PortfolioCategory[]): Promise<void> {
  await db.delete(portfolioCategories).where(eq(portfolioCategories.userId, userId));
  for (const item of items) await db.insert(portfolioCategories).values({ ...item, userId });
}
