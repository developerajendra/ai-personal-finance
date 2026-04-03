/**
 * Compatibility shim: delegates to SQLite repositories.
 * All functions now require userId. API routes should be updated to pass userId directly.
 * This file exists only for backward compatibility and will be removed in Phase 6.
 */

import * as investmentRepo from "@/core/db/repositories/investmentRepository";
import * as loanRepo from "@/core/db/repositories/loanRepository";
import * as propertyRepo from "@/core/db/repositories/propertyRepository";
import * as bankBalanceRepo from "@/core/db/repositories/bankBalanceRepository";
import * as transactionRepo from "@/core/db/repositories/transactionRepository";
import * as stockRepo from "@/core/db/repositories/stockRepository";
import * as mutualFundRepo from "@/core/db/repositories/mutualFundRepository";
import * as portfolioCategoryRepo from "@/core/db/repositories/portfolioCategoryRepository";
import type { Investment, Loan, Property, BankBalance, Transaction, PortfolioCategory } from "@/core/types";
import type { ZerodhaStock, ZerodhaMutualFund } from "@/core/services/zerodhaService";

const FILE_KEY_TO_REPO = {
  investments: investmentRepo,
  loans: loanRepo,
  properties: propertyRepo,
  bankBalances: bankBalanceRepo,
  transactions: transactionRepo,
  portfolioCategories: portfolioCategoryRepo,
} as const;

type FileKey = keyof typeof FILE_KEY_TO_REPO;

export function initializeStorage() {
  // No-op: SQLite is always ready
}

export function loadFromJson<T>(fileKey: FileKey, userId: string): T[] {
  const repo = FILE_KEY_TO_REPO[fileKey];
  return (repo as any).findByUserId(userId) as T[];
}

export function saveToJson<T extends { id: string }>(fileKey: FileKey, data: T[], userId: string): void {
  const repo = FILE_KEY_TO_REPO[fileKey];
  (repo as any).replaceAll(userId, data);
}

export function appendToJson<T extends { id: string }>(fileKey: FileKey, newItems: T[], userId: string): void {
  const repo = FILE_KEY_TO_REPO[fileKey];
  (repo as any).bulkCreate(userId, newItems);
}

export function updateInJson<T extends { id: string }>(
  fileKey: FileKey,
  id: string,
  updates: Partial<T>,
  userId: string
): T | null {
  const repo = FILE_KEY_TO_REPO[fileKey];
  return (repo as any).update(userId, id, updates) as T | null;
}

export function deleteFromJson<T extends { id: string }>(
  fileKey: FileKey,
  id: string,
  userId: string
): boolean {
  const repo = FILE_KEY_TO_REPO[fileKey];
  return (repo as any).remove(userId, id);
}

export function loadAllPortfolioData(userId: string) {
  return {
    investments: investmentRepo.findByUserId(userId),
    loans: loanRepo.findByUserId(userId),
    properties: propertyRepo.findByUserId(userId),
    bankBalances: bankBalanceRepo.findByUserId(userId),
    transactions: transactionRepo.findByUserId(userId),
  };
}

export function saveAllPortfolioData(
  userId: string,
  data: {
    investments?: Investment[];
    loans?: Loan[];
    properties?: Property[];
    bankBalances?: BankBalance[];
    transactions?: Transaction[];
  }
) {
  if (data.investments !== undefined) investmentRepo.replaceAll(userId, data.investments);
  if (data.loans !== undefined) loanRepo.replaceAll(userId, data.loans);
  if (data.properties !== undefined) propertyRepo.replaceAll(userId, data.properties);
  if (data.bankBalances !== undefined) bankBalanceRepo.replaceAll(userId, data.bankBalances);
  if (data.transactions !== undefined) transactionRepo.replaceAll(userId, data.transactions);
}

export function saveStocks(userId: string, stocks: ZerodhaStock[]): void {
  stockRepo.replaceAll(userId, stocks);
}

export function loadStocks(userId: string): ZerodhaStock[] {
  return stockRepo.findByUserId(userId);
}

export function saveMutualFunds(userId: string, mutualFunds: ZerodhaMutualFund[]): void {
  mutualFundRepo.replaceAll(userId, mutualFunds);
}

export function loadMutualFunds(userId: string): ZerodhaMutualFund[] {
  return mutualFundRepo.findByUserId(userId);
}
