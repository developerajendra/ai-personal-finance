import "server-only";
import { db } from "@/server/db/client";
import * as investmentRepo from "@/server/db/repositories/investmentRepository";
import * as loanRepo from "@/server/db/repositories/loanRepository";
import * as propertyRepo from "@/server/db/repositories/propertyRepository";
import * as bankBalanceRepo from "@/server/db/repositories/bankBalanceRepository";
import type { BankBalance, Investment, Loan, Property, Transaction } from "@/shared/types";
import { toPaise } from "@/shared/utils/money";
import { FinanceError, parseInput } from "@/server/finance/common";
import { transactionInputSchema } from "@/shared/schemas/finance";
import { prepareInvestment } from "@/server/finance/investments/service";
import { loanService } from "@/server/finance/loans/service";
import { propertyService } from "@/server/finance/properties/service";
import { bankBalanceService } from "@/server/finance/accounts/service";
import { importTransactions } from "@/server/finance/transactions/service";

export interface PortfolioImportItems {
  investments?: Partial<Investment>[];
  loans?: Partial<Loan>[];
  properties?: Partial<Property>[];
  bankBalances?: Partial<BankBalance>[];
}

export interface PortfolioImportResult {
  added: { investments: number; loans: number; properties: number; bankBalances: number };
  transactions: { inserted: number; skipped: number };
  totals: { investments: number; loans: number; properties: number; bankBalances: number };
  rejected: Array<{ kind: string; name?: string; reason: string }>;
}

const sameMoney = (a: number | undefined, b: number | undefined) =>
  a !== undefined && b !== undefined && toPaise(a) === toPaise(b);
const day = (d?: string) => (d ? d.slice(0, 10) : "");

/**
 * Merge imported items into the user's portfolio. Existing records are never
 * deleted or overwritten; an item is skipped when it matches an existing
 * record by the same identity the previous importer used. All inserts commit
 * together, so a failure leaves the portfolio unchanged.
 */
export async function importPortfolio(
  userId: string,
  items: PortfolioImportItems,
  transactions: { source: Transaction["source"]; rows: unknown[] } | null
): Promise<PortfolioImportResult> {
  const rejected: PortfolioImportResult["rejected"] = [];

  function tryPrepare<T>(kind: string, name: string | undefined, fn: () => T): T | null {
    try {
      return fn();
    } catch (error) {
      if (error instanceof FinanceError) {
        rejected.push({ kind, name, reason: error.message });
        return null;
      }
      throw error;
    }
  }

  return db.transaction(async (tx) => {
    const [existingInv, existingLoans, existingProps, existingBank] = await Promise.all([
      investmentRepo.findByUserId(userId, tx),
      loanRepo.findByUserId(userId, tx),
      propertyRepo.findByUserId(userId, tx),
      bankBalanceRepo.findByUserId(userId, tx),
    ]);

    // Imported items start as drafts (isPublished defaults to false).
    const newInvestments: investmentRepo.InvestmentValues[] = [];
    for (const item of items.investments ?? []) {
      const values = tryPrepare("investment", item.name, () => prepareInvestment(item, { isPublished: false }));
      if (!values) continue;
      const pool = [...existingInv, ...newInvestments];
      const duplicate = pool.some(
        (i) => i.name === values.name && sameMoney(i.amount, values.amount) && day(i.startDate) === day(values.startDate)
      );
      if (!duplicate && !pool.some((i) => i.id === values.id)) newInvestments.push(values);
    }

    const newLoans: loanRepo.LoanValues[] = [];
    for (const item of items.loans ?? []) {
      const values = tryPrepare("loan", item.name, () => loanService.prepare(item, { isPublished: false }));
      if (!values) continue;
      const pool = [...existingLoans, ...newLoans];
      const duplicate = pool.some((l) => l.name === values.name && sameMoney(l.principalAmount, values.principalAmount));
      if (!duplicate && !pool.some((l) => l.id === values.id)) newLoans.push(values);
    }

    const newProperties: propertyRepo.PropertyValues[] = [];
    for (const item of items.properties ?? []) {
      const values = tryPrepare("property", item.name, () => propertyService.prepare(item, { isPublished: false }));
      if (!values) continue;
      const pool = [...existingProps, ...newProperties];
      const duplicate = pool.some((p) => p.name === values.name && sameMoney(p.purchasePrice, values.purchasePrice));
      if (!duplicate && !pool.some((p) => p.id === values.id)) newProperties.push(values);
    }

    const newBankBalances: bankBalanceRepo.BankBalanceValues[] = [];
    for (const item of items.bankBalances ?? []) {
      const values = tryPrepare("bank-balance", item.bankName, () => bankBalanceService.prepare(item, { isPublished: false }));
      if (!values) continue;
      const pool = [...existingBank, ...newBankBalances];
      const duplicate = pool.some(
        (b) => b.bankName === values.bankName && (b.accountNumber ?? null) === (values.accountNumber ?? null)
      );
      if (!duplicate && !pool.some((b) => b.id === values.id)) newBankBalances.push(values);
    }

    await investmentRepo.insertMany(userId, newInvestments, tx);
    await loanRepo.insertMany(userId, newLoans, tx);
    await propertyRepo.insertMany(userId, newProperties, tx);
    await bankBalanceRepo.insertMany(userId, newBankBalances, tx);

    let txnResult = { inserted: 0, skipped: 0 };
    if (transactions && transactions.rows.length > 0) {
      const valid: unknown[] = [];
      for (const row of transactions.rows) {
        // Validate individually so one bad row doesn't block the rest.
        const ok = tryPrepare("transaction", (row as { description?: string })?.description, () =>
          parseInput(transactionInputSchema, row)
        );
        if (ok) valid.push(row);
      }
      txnResult = await importTransactions(userId, transactions.source, valid, tx);
    }

    return {
      added: {
        investments: newInvestments.length,
        loans: newLoans.length,
        properties: newProperties.length,
        bankBalances: newBankBalances.length,
      },
      transactions: txnResult,
      totals: {
        investments: existingInv.length + newInvestments.length,
        loans: existingLoans.length + newLoans.length,
        properties: existingProps.length + newProperties.length,
        bankBalances: existingBank.length + newBankBalances.length,
      },
      rejected,
    };
  });
}
