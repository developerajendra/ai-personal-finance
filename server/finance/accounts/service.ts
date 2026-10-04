import "server-only";
import * as bankBalanceRepo from "@/server/db/repositories/bankBalanceRepository";
import { bankBalanceInputSchema, bankBalanceUpdateSchema } from "@/shared/schemas/finance";
import { createEntityService } from "@/server/finance/entityService";
import type { BankBalance } from "@/shared/types";

/** Bank balances, deposits and receivables (bank balances tagged "receivable"). */
export const bankBalanceService = createEntityService({
  entity: "Bank balance",
  idPrefix: "bb",
  repo: bankBalanceRepo,
  createSchema: bankBalanceInputSchema,
  updateSchema: bankBalanceUpdateSchema,
  clearable: [
    "accountNumber", "assetType", "originalAmount", "originalCurrency", "description",
    "issueDate", "dueDate", "interestRate", "paidDate", "settledAmount", "tags",
  ],
  toValues: (parsed, { id, now, isPublished }): bankBalanceRepo.BankBalanceValues => ({
    ...parsed,
    id,
    isPublished,
    lastUpdated: parsed.lastUpdated ?? now,
    tags: parsed.tags ?? null,
    createdAt: now,
    updatedAt: now,
  }),
});

/**
 * Save money lent to a person (from chat / WhatsApp) as a DRAFT receivable. With a
 * sourceRef, a retried delivery returns the existing record instead of a duplicate.
 */
export async function createReceivableOnce(
  userId: string,
  input: Record<string, unknown>,
  identity: { channel: "web" | "whatsapp"; sourceRef?: string }
): Promise<{ receivable: BankBalance; created: boolean }> {
  const refTag = identity.sourceRef ? `ref:${identity.sourceRef}` : null;
  if (refTag) {
    const existing = (await bankBalanceRepo.findByUserId(userId)).find((b) => b.tags?.includes(refTag));
    if (existing) return { receivable: existing, created: false };
  }
  const tags = ["receivable", identity.channel === "whatsapp" ? "added from whatsapp" : "added from chat", ...(refTag ? [refTag] : [])];
  const receivable = await bankBalanceService.create(userId, { ...input, tags }, { isPublished: false });
  return { receivable, created: true };
}
