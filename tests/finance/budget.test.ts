import { describe, expect, it } from "vitest";
import { createUser } from "../helpers";
import {
  createBudgetEntry,
  createBudgetItem,
  deleteBudgetEntry,
  deleteBudgetItem,
  getBudget,
  updateBudgetItem,
} from "@/server/finance/budget/service";

const rent = { name: "House instalment", category: "Home", costType: "fixed", frequency: "monthly", amount: 28597, dueDay: 5 };

describe("budget", () => {
  it("creates items and month entries for the owner only", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const item = await createBudgetItem(alice, rent);
    expect(item).toMatchObject({ kind: "expense", active: true, dueDay: 5 });

    await createBudgetEntry(alice, { itemId: item.id, month: "2026-10", amount: 28597, date: "2026-10-04" });
    await createBudgetEntry(alice, { itemId: item.id, month: "2026-09", amount: 28597, date: "2026-09-05" });

    const oct = await getBudget(alice, "2026-10");
    expect(oct.items).toHaveLength(1);
    expect(oct.entries).toHaveLength(1);
    expect((await getBudget(bob, "2026-10")).items).toHaveLength(0);

    // Bob cannot log against, edit or delete Alice's item
    await expect(createBudgetEntry(bob, { itemId: item.id, month: "2026-10", amount: 1, date: "2026-10-04" })).rejects.toMatchObject({ status: 404 });
    await expect(updateBudgetItem(bob, item.id, { amount: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(deleteBudgetItem(bob, item.id)).rejects.toMatchObject({ status: 404 });
    await expect(deleteBudgetEntry(bob, oct.entries[0]!.id)).rejects.toMatchObject({ status: 404 });

    await deleteBudgetItem(alice, item.id);
    expect((await getBudget(alice, "2026-09")).entries).toHaveLength(0);
  });

  it("requires a due month for yearly items and clears it when switching to monthly", async () => {
    const alice = await createUser("alice");
    await expect(createBudgetItem(alice, { ...rent, frequency: "yearly" })).rejects.toMatchObject({ status: 400 });
    const fees = await createBudgetItem(alice, { name: "School fees", category: "Education", frequency: "yearly", dueMonth: 4, amount: 90000 });
    expect(fees.dueMonth).toBe(4);
    const monthly = await updateBudgetItem(alice, fees.id, { frequency: "monthly", dueDay: "" });
    expect(monthly.dueMonth).toBeUndefined();
    expect(monthly.dueDay).toBeUndefined();
  });

  it("records income items and rejects bad months", async () => {
    const alice = await createUser("alice");
    const salary = await createBudgetItem(alice, { kind: "income", name: "Salary — TTN", category: "Salary", amount: 150000, dueDay: 1 });
    expect(salary.kind).toBe("income");
    await expect(getBudget(alice, "2026-13")).rejects.toMatchObject({ status: 400 });
  });
});
