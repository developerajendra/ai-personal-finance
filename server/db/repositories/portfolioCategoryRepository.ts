import "server-only";
import { db, type Executor } from "@/server/db/client";
import { portfolioCategories } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { PortfolioCategory } from "@/shared/types";
import { chunk, definedOnly } from "./helpers";

type CategoryRow = typeof portfolioCategories.$inferSelect;
export type PortfolioCategoryValues = Omit<typeof portfolioCategories.$inferInsert, "userId">;

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

export async function findByUserId(userId: string, exec: Executor = db): Promise<PortfolioCategory[]> {
  const rows = await exec.select().from(portfolioCategories).where(eq(portfolioCategories.userId, userId));
  return rows.map(toAppModel);
}

export async function findById(userId: string, id: string, exec: Executor = db): Promise<PortfolioCategory | null> {
  const [row] = await exec
    .select()
    .from(portfolioCategories)
    .where(and(eq(portfolioCategories.userId, userId), eq(portfolioCategories.id, id)))
    .limit(1);
  return row ? toAppModel(row) : null;
}

export async function insert(userId: string, values: PortfolioCategoryValues, exec: Executor = db): Promise<PortfolioCategory> {
  const [row] = await exec.insert(portfolioCategories).values({ ...values, userId }).returning();
  return toAppModel(row);
}

export async function insertMany(userId: string, items: PortfolioCategoryValues[], exec: Executor = db): Promise<number> {
  for (const part of chunk(items)) {
    await exec.insert(portfolioCategories).values(part.map((v) => ({ ...v, userId })));
  }
  return items.length;
}

export async function update(
  userId: string,
  id: string,
  values: Partial<PortfolioCategoryValues>,
  exec: Executor = db
): Promise<PortfolioCategory | null> {
  const { id: _ignoredId, ...rest } = values;
  const [row] = await exec
    .update(portfolioCategories)
    .set({ ...definedOnly(rest), updatedAt: new Date().toISOString() })
    .where(and(eq(portfolioCategories.userId, userId), eq(portfolioCategories.id, id)))
    .returning();
  return row ? toAppModel(row) : null;
}

export async function remove(userId: string, id: string, exec: Executor = db): Promise<boolean> {
  const result = await exec.delete(portfolioCategories).where(and(eq(portfolioCategories.userId, userId), eq(portfolioCategories.id, id)));
  return result.rowsAffected > 0;
}
