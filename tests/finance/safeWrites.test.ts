import { describe, expect, it } from "vitest";
import { createUser } from "../helpers";
import { createInvestment, listInvestments, updateInvestment } from "@/server/finance/investments/service";
import { applyLoanRateChange, applyLoanStatement, loanService } from "@/server/finance/loans/service";
import { setPublished } from "@/server/finance/portfolio/service";
import * as loanSnapshotRepo from "@/server/db/repositories/loanSnapshotRepository";
import { summarizeTransactions } from "@/server/finance/transactions/service";
import { sumMoney, toMoney } from "@/shared/utils/money";

describe("safe financial writes", () => {
  it("creating a record leaves every existing record untouched", async () => {
    const user = await createUser();
    const a = await createInvestment(user, { name: "A", amount: 100, type: "fd", startDate: "2026-01-01" });
    const before = await listInvestments(user);
    await createInvestment(user, { name: "B", amount: 200, type: "ppf", startDate: "2026-01-02" });
    const after = await listInvestments(user);

    expect(after).toHaveLength(2);
    // Same row, same timestamps: it was not deleted and re-inserted.
    expect(after.find((i) => i.id === a.id)).toEqual(before[0]);
  });

  it("publishing updates exactly one row", async () => {
    const user = await createUser();
    const a = await createInvestment(user, { name: "A", amount: 1, type: "fd", startDate: "2026-01-01" }, { isPublished: false });
    const b = await createInvestment(user, { name: "B", amount: 2, type: "fd", startDate: "2026-01-01" }, { isPublished: false });
    await setPublished(user, "investment", a.id, true);
    const rows = await listInvestments(user);
    expect(rows.find((r) => r.id === a.id)?.isPublished).toBe(true);
    expect(rows.find((r) => r.id === b.id)?.isPublished).toBe(false);
  });

  it("rejects invalid input instead of saving it", async () => {
    const user = await createUser();
    await expect(createInvestment(user, { name: "", amount: 10, type: "fd", startDate: "2026-01-01" })).rejects.toMatchObject({ status: 400 });
    await expect(createInvestment(user, { name: "X", amount: "abc", type: "fd", startDate: "2026-01-01" })).rejects.toMatchObject({ status: 400 });
    await expect(createInvestment(user, { name: "X", amount: 1, type: "crypto", startDate: "2026-01-01" })).rejects.toMatchObject({ status: 400 });
    expect(await listInvestments(user)).toHaveLength(0);
  });

  it("stores money at paise precision and sums without float drift", async () => {
    const user = await createUser();
    const inv = await createInvestment(user, { name: "X", amount: 1234.565, type: "fd", startDate: "2026-01-01" });
    expect(inv.amount).toBe(1234.57);
    expect(toMoney(1.005)).toBe(1.01);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    const summary = summarizeTransactions([
      { id: "1", date: "2026-01-01", amount: 0.1, description: "a", category: "x", type: "credit", source: "manual" },
      { id: "2", date: "2026-01-01", amount: 0.2, description: "b", category: "x", type: "credit", source: "manual" },
    ]);
    expect(summary.totalIncome).toBe(0.3);
  });

  it("an explicit empty value clears an optional field on update", async () => {
    const user = await createUser();
    const inv = await createInvestment(user, { name: "X", amount: 1, type: "fd", startDate: "2026-01-01", maturityDate: "2027-01-01" });
    const updated = await updateInvestment(user, inv.id, { maturityDate: "" });
    expect(updated.maturityDate).toBeUndefined();
  });

  it("loan statement is atomic: a missing loan writes no snapshot", async () => {
    const user = await createUser();
    await expect(
      applyLoanStatement(user, "no-such-loan", { outstandingAmount: 1, interestRate: 8 }, {
        id: "snap-1", loanId: "no-such-loan", year: 2026, month: 3, outstandingAmount: 1, principalPaid: 0,
        interestPaid: 0, emiAmount: 0, interestRate: 8, remainingTenureMonths: 1, snapshotDate: "2026-03-31",
        createdAt: "", updatedAt: "",
      })
    ).rejects.toMatchObject({ status: 404 });
    expect(await loanSnapshotRepo.findByLoanId(user, "no-such-loan")).toHaveLength(0);
  });

  it("rate change updates the loan and later snapshots together", async () => {
    const user = await createUser();
    const loan = await loanService.create(user, {
      name: "Home", type: "home-loan", principalAmount: 100, outstandingAmount: 90, interestRate: 8,
      startDate: "2024-01-01", emiAmount: 10, emiDate: 5, tenureMonths: 12,
    });
    for (const month of [1, 2, 3]) {
      await loanSnapshotRepo.upsert(user, {
        id: `s-${month}`, loanId: loan.id, year: 2026, month, outstandingAmount: 90, principalPaid: 0, interestPaid: 0,
        emiAmount: 10, interestRate: 8, remainingTenureMonths: 10, snapshotDate: `2026-0${month}-28`, createdAt: "", updatedAt: "",
      });
    }
    const { updatedSnapshots, loan: updated } = await applyLoanRateChange(user, loan.id, 9, new Date(2026, 1, 1));
    expect(updated.interestRate).toBe(9);
    expect(updatedSnapshots).toBe(2);
    const snaps = await loanSnapshotRepo.findByLoanId(user, loan.id);
    expect(snaps.map((s) => s.interestRate)).toEqual([8, 9, 9]);
  });
});
