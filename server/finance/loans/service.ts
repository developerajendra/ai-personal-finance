import "server-only";
import { db } from "@/server/db/client";
import * as loanRepo from "@/server/db/repositories/loanRepository";
import * as loanSnapshotRepo from "@/server/db/repositories/loanSnapshotRepository";
import { loanInputSchema, loanUpdateSchema } from "@/shared/schemas/finance";
import type { Loan, LoanMonthlySnapshot } from "@/shared/types";
import { toMoney } from "@/shared/utils/money";
import { NotFoundError } from "@/server/finance/common";
import { createEntityService } from "@/server/finance/entityService";

export const loanService = createEntityService({
  entity: "Loan",
  idPrefix: "loan",
  repo: loanRepo,
  createSchema: loanInputSchema,
  updateSchema: loanUpdateSchema,
  clearable: ["endDate", "description"],
  toValues: (parsed, { id, now, isPublished }): loanRepo.LoanValues => ({
    ...parsed,
    id,
    isPublished,
    createdAt: now,
    updatedAt: now,
  }),
});

/**
 * Apply a quarterly statement atomically: the loan's outstanding amount and
 * rate change together with the month's snapshot, or not at all.
 */
export async function applyLoanStatement(
  userId: string,
  loanId: string,
  update: { outstandingAmount: number; interestRate: number },
  snapshot: LoanMonthlySnapshot
): Promise<{ loan: Loan; snapshot: LoanMonthlySnapshot }> {
  return db.transaction(async (tx) => {
    const loan = await loanRepo.update(
      userId,
      loanId,
      { outstandingAmount: toMoney(update.outstandingAmount), interestRate: update.interestRate },
      tx
    );
    if (!loan) throw new NotFoundError("Loan");
    const saved = await loanSnapshotRepo.upsert(userId, { ...snapshot, loanId }, tx);
    return { loan, snapshot: saved };
  });
}

/**
 * Change a loan's rate and re-rate every snapshot on/after the effective date
 * in one transaction.
 */
export async function applyLoanRateChange(
  userId: string,
  loanId: string,
  newRate: number,
  effectiveDate: Date
): Promise<{ loan: Loan; updatedSnapshots: number }> {
  return db.transaction(async (tx) => {
    const loan = await loanRepo.update(userId, loanId, { interestRate: newRate }, tx);
    if (!loan) throw new NotFoundError("Loan");
    const all = await loanSnapshotRepo.findByLoanId(userId, loanId, tx);
    let updatedSnapshots = 0;
    const effective = new Date(effectiveDate);
    effective.setHours(0, 0, 0, 0);
    for (const snapshot of all) {
      const snapshotDate = new Date(snapshot.year, snapshot.month, 0);
      snapshotDate.setHours(0, 0, 0, 0);
      if (snapshotDate >= effective) {
        await loanSnapshotRepo.upsert(
          userId,
          { ...snapshot, interestRate: newRate, updatedAt: new Date().toISOString() },
          tx
        );
        updatedSnapshots++;
      }
    }
    return { loan, updatedSnapshots };
  });
}
