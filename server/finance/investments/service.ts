import "server-only";
import { db, type Executor } from "@/server/db/client";
import * as investmentRepo from "@/server/db/repositories/investmentRepository";
import { isUniqueConstraintError } from "@/server/db/repositories/helpers";
import {
  investmentInputSchema,
  investmentUpdateSchema,
} from "@/shared/schemas/finance";
import type { Investment } from "@/shared/types";
import {
  ConflictError,
  NotFoundError,
  clearedFields,
  newId,
  parseInput,
  type SourceIdentity,
} from "@/server/finance/common";

const CLEARABLE = [
  "currency", "originalAmount", "originalCurrency", "assetType", "endDate", "maturityDate",
  "maturityAmount", "originalMaturityAmount", "interestRate", "compoundingMonths", "ruleLabel", "ruleFormula",
  "description", "tags",
] as const;

export function listInvestments(userId: string, exec: Executor = db): Promise<Investment[]> {
  return investmentRepo.findByUserId(userId, exec);
}

export function getInvestment(userId: string, id: string, exec: Executor = db): Promise<Investment | null> {
  return investmentRepo.findById(userId, id, exec);
}

export function prepareInvestment(
  input: unknown,
  defaults: { isPublished: boolean },
  identity?: SourceIdentity
): investmentRepo.InvestmentValues {
  const parsed = parseInput(investmentInputSchema, input);
  const now = new Date().toISOString();
  return {
    ...parsed,
    id: parsed.id ?? newId("inv"),
    isPublished: parsed.isPublished ?? defaults.isPublished,
    tags: parsed.tags ?? null,
    source: identity?.source ?? null,
    sourceRef: identity?.sourceRef ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createInvestment(
  userId: string,
  input: unknown,
  options: { isPublished?: boolean; exec?: Executor } = {}
): Promise<Investment> {
  const values = prepareInvestment(input, { isPublished: options.isPublished ?? true });
  try {
    return await investmentRepo.insert(userId, values, options.exec ?? db);
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new ConflictError("An investment with this id already exists");
    throw error;
  }
}

/**
 * Create an investment exactly once per source identity (e.g. a WhatsApp
 * message id). A retried delivery returns the existing record instead of
 * creating a duplicate.
 */
export async function createInvestmentOnce(
  userId: string,
  input: unknown,
  identity: SourceIdentity,
  options: { isPublished?: boolean } = {}
): Promise<{ investment: Investment; created: boolean }> {
  const existing = await investmentRepo.findBySourceRef(userId, identity.source, identity.sourceRef);
  if (existing) return { investment: existing, created: false };
  const values = prepareInvestment(input, { isPublished: options.isPublished ?? false }, identity);
  try {
    return { investment: await investmentRepo.insert(userId, values), created: true };
  } catch (error) {
    // A concurrent retry won the race; the unique index guarantees one row.
    if (isUniqueConstraintError(error)) {
      const winner = await investmentRepo.findBySourceRef(userId, identity.source, identity.sourceRef);
      if (winner) return { investment: winner, created: false };
    }
    throw error;
  }
}

export async function updateInvestment(
  userId: string,
  id: string,
  patch: unknown,
  exec: Executor = db
): Promise<Investment> {
  const parsed = parseInput(investmentUpdateSchema, patch);
  const updated = await investmentRepo.update(
    userId,
    id,
    { ...parsed, ...clearedFields(patch, CLEARABLE) },
    exec
  );
  if (!updated) throw new NotFoundError("Investment");
  return updated;
}

export async function deleteInvestment(userId: string, id: string): Promise<void> {
  const removed = await investmentRepo.remove(userId, id);
  if (!removed) throw new NotFoundError("Investment");
}

export async function setInvestmentPublished(userId: string, id: string, isPublished: boolean): Promise<Investment> {
  const updated = await investmentRepo.update(userId, id, { isPublished });
  if (!updated) throw new NotFoundError("Investment");
  return updated;
}

/**
 * Case-insensitive lookup by name for conversational updates. Returns every
 * candidate so the caller can ask the user to disambiguate.
 */
export async function findInvestmentsByName(userId: string, name: string): Promise<Investment[]> {
  const needle = name.trim().toLowerCase();
  if (!needle) return [];
  const all = await investmentRepo.findByUserId(userId);
  const exact = all.filter((i) => i.name.toLowerCase() === needle);
  if (exact.length > 0) return exact;
  return all.filter((i) => {
    const n = i.name.toLowerCase();
    return n.includes(needle) || needle.includes(n);
  });
}
