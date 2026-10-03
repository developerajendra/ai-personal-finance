import "server-only";
import * as investmentRepo from "@/server/db/repositories/investmentRepository";
import * as loanRepo from "@/server/db/repositories/loanRepository";
import * as propertyRepo from "@/server/db/repositories/propertyRepository";
import * as bankBalanceRepo from "@/server/db/repositories/bankBalanceRepository";
import * as transactionRepo from "@/server/db/repositories/transactionRepository";
import * as stockRepo from "@/server/db/repositories/stockRepository";
import * as mutualFundRepo from "@/server/db/repositories/mutualFundRepository";
import type { ZerodhaMutualFund, ZerodhaStock } from "@/shared/types";
import { ValidationError } from "@/server/finance/common";
import { setInvestmentPublished } from "@/server/finance/investments/service";
import { loanService } from "@/server/finance/loans/service";
import { propertyService } from "@/server/finance/properties/service";
import { bankBalanceService } from "@/server/finance/accounts/service";

/** Read-only snapshot of a user's records for dashboards and AI context. */
export async function loadPortfolio(userId: string) {
  const [investments, loans, properties, bankBalances, transactions] = await Promise.all([
    investmentRepo.findByUserId(userId),
    loanRepo.findByUserId(userId),
    propertyRepo.findByUserId(userId),
    bankBalanceRepo.findByUserId(userId),
    transactionRepo.findByUserId(userId),
  ]);
  return { investments, loans, properties, bankBalances, transactions };
}

export type PublishableType = "investment" | "loan" | "property" | "bank-balance";

/** Toggle draft/published for one record without rewriting the table. */
export async function setPublished(userId: string, type: PublishableType, id: string, isPublished: boolean) {
  switch (type) {
    case "investment":
      return setInvestmentPublished(userId, id, isPublished);
    case "loan":
      return loanService.setPublished(userId, id, isPublished);
    case "property":
      return propertyService.setPublished(userId, id, isPublished);
    case "bank-balance":
      return bankBalanceService.setPublished(userId, id, isPublished);
    default:
      throw new ValidationError(`Unknown item type: ${String(type)}`);
  }
}

// ─── Broker holdings (Zerodha cache) ────────────────────────────────

export function loadStocks(userId: string): Promise<ZerodhaStock[]> {
  return stockRepo.findByUserId(userId);
}

export function saveStocks(userId: string, stocks: ZerodhaStock[]): Promise<void> {
  return stockRepo.replaceAll(userId, stocks);
}

export function loadMutualFunds(userId: string): Promise<ZerodhaMutualFund[]> {
  return mutualFundRepo.findByUserId(userId);
}

export function saveMutualFunds(userId: string, funds: ZerodhaMutualFund[]): Promise<void> {
  return mutualFundRepo.replaceAll(userId, funds);
}
