import "server-only";
import * as repo from "@/server/db/repositories/subscriptionRepository";
import type { Subscription } from "@/shared/types";
import { subscriptionInputSchema, subscriptionUpdateSchema } from "@/shared/schemas/finance";
import { NotFoundError, newId, parseInput } from "@/server/finance/common";

export function listSubscriptions(userId: string): Promise<Subscription[]> {
  return repo.findByUserId(userId);
}

export async function createSubscription(userId: string, input: unknown): Promise<Subscription> {
  const parsed = parseInput(subscriptionInputSchema, input);
  const now = new Date().toISOString();
  return repo.insert(userId, { ...parsed, id: newId("sub"), createdAt: now, updatedAt: now });
}

export async function updateSubscription(userId: string, id: string, patch: unknown): Promise<Subscription> {
  const parsed = parseInput(subscriptionUpdateSchema, patch);
  const updated = await repo.update(userId, id, parsed);
  if (!updated) throw new NotFoundError("Subscription not found");
  return updated;
}

export async function deleteSubscription(userId: string, id: string): Promise<void> {
  if (!(await repo.remove(userId, id))) throw new NotFoundError("Subscription not found");
}
