import "server-only";
import * as categoryRepo from "@/server/db/repositories/portfolioCategoryRepository";
import {
  portfolioCategoryInputSchema,
  portfolioCategoryUpdateSchema,
} from "@/shared/schemas/finance";
import type { PortfolioCategory } from "@/shared/types";
import { ValidationError, NotFoundError, newId, parseInput } from "@/server/finance/common";

export function listCategories(userId: string): Promise<PortfolioCategory[]> {
  return categoryRepo.findByUserId(userId);
}

export function getCategory(userId: string, id: string): Promise<PortfolioCategory | null> {
  return categoryRepo.findById(userId, id);
}

async function assertSlugAvailable(userId: string, slug: string, exceptId?: string) {
  const existing = await categoryRepo.findByUserId(userId);
  if (existing.some((c) => c.slug === slug && c.id !== exceptId)) {
    throw new ValidationError("A category with this slug already exists");
  }
}

export async function createCategory(userId: string, input: unknown): Promise<PortfolioCategory> {
  const parsed = parseInput(portfolioCategoryInputSchema, input);
  await assertSlugAvailable(userId, parsed.slug);
  const now = new Date().toISOString();
  return categoryRepo.insert(userId, { ...parsed, id: newId("cat"), createdAt: now, updatedAt: now });
}

export async function updateCategory(userId: string, id: string, patch: unknown): Promise<PortfolioCategory> {
  const parsed = parseInput(portfolioCategoryUpdateSchema, patch);
  if (parsed.slug) await assertSlugAvailable(userId, parsed.slug, id);
  // An explicit empty icon/description clears the value, as before.
  const raw = (patch ?? {}) as Record<string, unknown>;
  const cleared: Partial<categoryRepo.PortfolioCategoryValues> = {};
  if ("icon" in raw && !raw.icon) cleared.icon = null;
  if ("description" in raw && !raw.description) cleared.description = null;
  const updated = await categoryRepo.update(userId, id, { ...parsed, ...cleared });
  if (!updated) throw new NotFoundError("Category");
  return updated;
}

export async function deleteCategory(userId: string, id: string): Promise<void> {
  if (!(await categoryRepo.remove(userId, id))) throw new NotFoundError("Category");
}
