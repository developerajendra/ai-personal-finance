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

export async function loadFromJson<T>(fileKey: FileKey, userId: string): Promise<T[]> {
  const repo = FILE_KEY_TO_REPO[fileKey];
  return (repo as any).findByUserId(userId) as Promise<T[]>;
}

export async function saveToJson<T extends { id: string }>(fileKey: FileKey, data: T[], userId: string): Promise<void> {
  const repo = FILE_KEY_TO_REPO[fileKey];
  await (repo as any).replaceAll(userId, data);
}

export async function appendToJson<T extends { id: string }>(fileKey: FileKey, newItems: T[], userId: string): Promise<void> {
  const repo = FILE_KEY_TO_REPO[fileKey];
  await (repo as any).bulkCreate(userId, newItems);
}

export async function updateInJson<T extends { id: string }>(
  fileKey: FileKey,
  id: string,
  updates: Partial<T>,
  userId: string
): Promise<T | null> {
  const repo = FILE_KEY_TO_REPO[fileKey];
  return (repo as any).update(userId, id, updates) as Promise<T | null>;
}

export async function deleteFromJson<T extends { id: string }>(
  fileKey: FileKey,
  id: string,
  userId: string
): Promise<boolean> {
  const repo = FILE_KEY_TO_REPO[fileKey];
  return (repo as any).remove(userId, id) as Promise<boolean>;
}

export async function loadAllPortfolioData(userId: string) {
  const [investments, loans, properties, bankBalances, transactions] = await Promise.all([
    investmentRepo.findByUserId(userId),
    loanRepo.findByUserId(userId),
    propertyRepo.findByUserId(userId),
    bankBalanceRepo.findByUserId(userId),
    transactionRepo.findByUserId(userId),
  ]);
  return { investments, loans, properties, bankBalances, transactions };
}

export async function saveAllPortfolioData(
  userId: string,
  data: {
    investments?: Investment[];
    loans?: Loan[];
    properties?: Property[];
    bankBalances?: BankBalance[];
    transactions?: Transaction[];
  }
): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (data.investments !== undefined) tasks.push(investmentRepo.replaceAll(userId, data.investments));
  if (data.loans !== undefined) tasks.push(loanRepo.replaceAll(userId, data.loans));
  if (data.properties !== undefined) tasks.push(propertyRepo.replaceAll(userId, data.properties));
  if (data.bankBalances !== undefined) tasks.push(bankBalanceRepo.replaceAll(userId, data.bankBalances));
  if (data.transactions !== undefined) tasks.push(transactionRepo.replaceAll(userId, data.transactions));
  await Promise.all(tasks);
}

export async function saveStocks(userId: string, stocks: ZerodhaStock[]): Promise<void> {
  await stockRepo.replaceAll(userId, stocks);
}

export async function loadStocks(userId: string): Promise<ZerodhaStock[]> {
  return stockRepo.findByUserId(userId);
}

export async function saveMutualFunds(userId: string, mutualFunds: ZerodhaMutualFund[]): Promise<void> {
  await mutualFundRepo.replaceAll(userId, mutualFunds);
}

export async function loadMutualFunds(userId: string): Promise<ZerodhaMutualFund[]> {
  return mutualFundRepo.findByUserId(userId);
}
