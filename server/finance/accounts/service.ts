import "server-only";
import * as bankBalanceRepo from "@/server/db/repositories/bankBalanceRepository";
import { bankBalanceInputSchema, bankBalanceUpdateSchema } from "@/shared/schemas/finance";
import { createEntityService } from "@/server/finance/entityService";

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
