import { describe, expect, it } from "vitest";
import { createUser } from "../helpers";
import { createInvestment, listInvestments } from "@/server/finance/investments/service";
import { createTransaction, listTransactions } from "@/server/finance/transactions/service";
import { importPortfolio } from "@/server/imports/portfolioImport";

const row = (description: string, amount = 500, date = "2026-03-01") => ({
  id: `excel-${description}`,
  date,
  amount,
  description,
  category: "uncategorized",
  type: "debit",
  source: "excel",
});

describe("imports preserve existing data", () => {
  it("keeps existing investments and transactions", async () => {
    const user = await createUser();
    const manualInv = await createInvestment(user, { name: "Manual FD", amount: 1000, type: "fd", startDate: "2025-01-01" });
    const manualTxn = await createTransaction(user, { date: "2026-01-01", amount: 99, description: "Coffee", type: "debit" });

    const result = await importPortfolio(
      user,
      { investments: [{ name: "Imported PPF", amount: 5000, type: "ppf", startDate: "2020-04-01", status: "active" }] },
      { source: "excel", rows: [row("Rent")] }
    );

    expect(result.added.investments).toBe(1);
    const invs = await listInvestments(user);
    expect(invs.map((i) => i.id)).toContain(manualInv.id);
    expect(invs.find((i) => i.name === "Imported PPF")?.isPublished).toBe(false); // drafts
    const txns = await listTransactions(user);
    expect(txns.map((t) => t.id)).toContain(manualTxn.id);
    expect(txns).toHaveLength(2);
  });

  it("re-importing the same file adds nothing", async () => {
    const user = await createUser();
    const items = { investments: [{ name: "PPF", amount: 5000, type: "ppf", startDate: "2020-04-01" }] } as const;
    const rows = [row("Rent"), row("Groceries", 1200)];
    await importPortfolio(user, items as any, { source: "excel", rows });
    const second = await importPortfolio(user, items as any, { source: "excel", rows });

    expect(second.added.investments).toBe(0);
    expect(second.transactions).toEqual({ inserted: 0, skipped: 2 });
    expect(await listTransactions(user)).toHaveLength(2);
    expect(await listInvestments(user)).toHaveLength(1);
  });

  it("keeps genuinely repeated identical rows within one file", async () => {
    const user = await createUser();
    const result = await importPortfolio(user, {}, { source: "excel", rows: [row("Transfer"), row("Transfer")] });
    expect(result.transactions.inserted).toBe(2);
  });

  it("skips invalid items without aborting the rest", async () => {
    const user = await createUser();
    const result = await importPortfolio(
      user,
      { investments: [{ name: "Bad", amount: Number.NaN, type: "fd", startDate: "2020-01-01" }, { name: "Good", amount: 1, type: "fd", startDate: "2020-01-01" }] },
      null
    );
    expect(result.added.investments).toBe(1);
    expect(result.rejected).toHaveLength(1);
  });
});
