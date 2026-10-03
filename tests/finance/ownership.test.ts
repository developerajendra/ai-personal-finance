import { describe, expect, it } from "vitest";
import { createUser } from "../helpers";
import {
  createInvestment,
  deleteInvestment,
  getInvestment,
  listInvestments,
  updateInvestment,
} from "@/server/finance/investments/service";
import { createTransaction, deleteTransaction, listTransactions, updateTransaction } from "@/server/finance/transactions/service";
import { loanService } from "@/server/finance/loans/service";

const fd = { name: "HDFC FD", amount: 50000, type: "fd", startDate: "2026-01-01" };

describe("ownership isolation", () => {
  it("never exposes or mutates another user's investment", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const inv = await createInvestment(alice, fd);

    expect(await getInvestment(bob, inv.id)).toBeNull();
    expect(await listInvestments(bob)).toHaveLength(0);
    await expect(updateInvestment(bob, inv.id, { amount: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(deleteInvestment(bob, inv.id)).rejects.toMatchObject({ status: 404 });
    expect((await getInvestment(alice, inv.id))?.amount).toBe(50000);
  });

  it("ignores ownership fields smuggled into an update body", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const inv = await createInvestment(alice, fd);

    await updateInvestment(alice, inv.id, { amount: 60000, userId: bob, id: "hijacked" });

    expect(await listInvestments(bob)).toHaveLength(0);
    const mine = await getInvestment(alice, inv.id);
    expect(mine?.amount).toBe(60000);
  });

  it("scopes transactions and loans to their owner", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const txn = await createTransaction(alice, {
      date: "2026-02-01", amount: 250, description: "Lunch", type: "debit", source: "manual",
    });
    const loan = await loanService.create(alice, {
      name: "Home loan", type: "home-loan", principalAmount: 1000000, outstandingAmount: 900000,
      interestRate: 8.5, startDate: "2024-01-01", emiAmount: 12000, emiDate: 5, tenureMonths: 240,
    });

    expect(await listTransactions(bob)).toHaveLength(0);
    await expect(updateTransaction(bob, txn.id, { amount: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(deleteTransaction(bob, txn.id)).rejects.toMatchObject({ status: 404 });
    expect(await loanService.get(bob, loan.id)).toBeNull();
    await expect(loanService.setPublished(bob, loan.id, false)).rejects.toMatchObject({ status: 404 });
  });
});
