import { describe, expect, it } from "vitest";
import {
  amortisedEmi,
  cashCover,
  cashFlowForMonth,
  cashFlowThisMonth,
  debtSummary,
  emiCheck,
  liquidityTiers,
  nextEmiDate,
  rankAttention,
  subscriptionSummary,
  type Attention,
} from "@/shared/utils/dashboardInsights";
import { buildCashEvents } from "@/shared/utils/upcoming";
import type { BankBalance, BudgetItem, Investment, Loan, Subscription, Transaction } from "@/shared/types";

const NOW = new Date(2026, 9, 4, 10, 0); // 4 Oct 2026

const loan = (l: Partial<Loan>): Loan =>
  ({
    id: "l1",
    name: "House Loan",
    type: "home-loan",
    principalAmount: 2_000_000,
    outstandingAmount: 1_900_000,
    emiAmount: 22_965,
    emiDate: 5,
    interestRate: 6.75,
    tenureMonths: 120,
    status: "active",
    startDate: "2026-01-02",
    isPublished: true,
    createdAt: "2026-01-02",
    updatedAt: "2026-10-03",
    ...l,
  }) as Loan;

describe("EMI checks", () => {
  it("computes the amortising EMI from the recorded terms", () => {
    expect(amortisedEmi(2_000_000, 6.75, 120)).toBeCloseTo(22_965, -1);
    expect(amortisedEmi(120_000, 0, 12)).toBe(10_000);
    expect(amortisedEmi(0, 7, 12)).toBeNull();
  });

  it("keeps an unknown EMI distinct from zero", () => {
    expect(emiCheck(loan({ emiAmount: 0 })).status).toBe("unknown");
    expect(emiCheck(loan({ emiAmount: undefined as any })).status).toBe("unknown");
  });

  it("rejects an EMI larger than the principal (the observed ₹20,54,013 House Loan EMI)", () => {
    const c = emiCheck(loan({ emiAmount: 2_054_013 }));
    expect(c.status).toBe("implausible");
    expect(c.emi).toBeNull(); // never used as a monthly payment
  });

  it("marks an EMI far from the terms as unverified, but keeps a consistent one", () => {
    expect(emiCheck(loan({ emiAmount: 55_000 })).status).toBe("mismatch");
    expect(emiCheck(loan({ emiAmount: 23_100 })).status).toBe("known");
  });

  it("finds the next EMI date, clamping to short months and stopping after the end date", () => {
    expect(nextEmiDate({ emiDate: 5 }, NOW)).toEqual(new Date(2026, 9, 5));
    expect(nextEmiDate({ emiDate: 2 }, NOW)).toEqual(new Date(2026, 10, 2));
    expect(nextEmiDate({ emiDate: 31 }, new Date(2026, 10, 3))).toEqual(new Date(2026, 10, 30));
    expect(nextEmiDate({ emiDate: 2, endDate: "2026-10-31" }, NOW)).toBeNull();
  });
});

describe("debt summary", () => {
  it("totals outstanding balances and known EMIs, flagging incomplete data", () => {
    const d = debtSummary([loan({}), loan({ id: "car", name: "Car Loan", emiAmount: 0, outstandingAmount: 600_000, emiDate: 10 })], NOW);
    expect(d.outstanding).toBe(2_500_000);
    expect(d.knownEmi).toBe(22_965);
    expect(d.incomplete).toBe(true);
    expect(d.next).toMatchObject({ amount: 22_965 });
    expect(d.next!.date).toEqual(new Date(2026, 9, 5));
  });

  it("reports a loan record that disagrees with its latest statement instead of picking one", () => {
    const d = debtSummary([loan({ outstandingAmount: 3_151_000 })], NOW, { l1: { date: new Date(2026, 8, 30), outstanding: 2_927_000 } });
    expect(d.statementConflicts).toHaveLength(1);
    expect(d.statementConflicts[0]).toMatchObject({ record: 3_151_000, statement: 2_927_000 });
  });
});

describe("cash cover", () => {
  const acct = (b: Partial<BankBalance>) => ({ id: "b", bankName: "ICICI", balance: 150_000, lastUpdated: "2026-09-30", ...b }) as BankBalance;
  const item = (i: Partial<BudgetItem>) => ({ id: "i", kind: "expense", name: "Rent", category: "Home", costType: "fixed", frequency: "monthly", amount: 30_000, active: true, ...i }) as BudgetItem;

  it("is unavailable without a Budget plan rather than assuming zero spending", () => {
    const c = cashCover({ cashAccounts: [acct({})], budgetItems: [], loans: [], now: NOW, staleDays: 60 });
    expect(c.status).toBe("unavailable");
    expect(c.months).toBeNull();
  });

  it("uses the plan's monthly equivalent plus known EMIs, counting loan-linked items once", () => {
    const c = cashCover({
      cashAccounts: [acct({ balance: 300_000 })],
      budgetItems: [item({}), item({ id: "ins", amount: 24_000, frequency: "yearly" }), item({ id: "emi", loanId: "l1", amount: 22_965 })],
      loans: [loan({})],
      now: NOW,
      staleDays: 60,
    });
    expect(c.planned).toBe(32_000);
    expect(c.emi).toBe(22_965);
    expect(c.months).toBeCloseTo(300_000 / 54_965, 5);
    expect(c.status).toBe("ok");
  });

  it("is provisional when an EMI is unknown or balances are mostly stale", () => {
    const c = cashCover({ cashAccounts: [acct({ lastUpdated: "2022-01-01" })], budgetItems: [item({})], loans: [loan({ emiAmount: 0 })], now: NOW, staleDays: 60 });
    expect(c.status).toBe("provisional");
    expect(c.reasons).toHaveLength(2);
    expect(c.staleAccounts).toHaveLength(1);
  });
});

describe("liquidity tiers", () => {
  const fd = (i: Partial<Investment>) => ({ id: "f", name: "FD", type: "fd", amount: 100_000, status: "active", startDate: "2025-01-01", ...i }) as Investment;
  it("separates maturing, breakable and locked deposits, and keeps receivables out of the tiers", () => {
    const { tiers, receivables } = liquidityTiers({
      cashAccounts: [{ id: "b", balance: 50_000, lastUpdated: "2026-09-30" } as BankBalance],
      deposits: [fd({ maturityDate: "2026-11-01" }), fd({ id: "g", maturityDate: "2028-01-01" }), fd({ id: "h", maturityDate: "2030-01-01", assetType: "fixed" })],
      marketValue: 200_000,
      marketLive: false,
      retirement: 300_000,
      ppfAccounts: [],
      properties: [],
      receivables: 70_000,
      now: NOW,
    });
    const by = Object.fromEntries(tiers.flatMap((t) => t.lines.map((l) => [l.key, { tier: t.key, value: l.value }])));
    expect(by.cash).toEqual({ tier: "now", value: 50_000 });
    expect(by.market.tier).toBe("soon");
    expect(by.maturing.tier).toBe("soon");
    expect(by.breakable.tier).toBe("soon");
    expect(by.locked.tier).toBe("long");
    expect(by.retirement.tier).toBe("long");
    expect(receivables.value).toBe(70_000);
    expect(tiers.find((t) => t.key === "now")!.total).toBe(50_000);
  });
});

describe("subscriptions", () => {
  const sub = (s: Partial<Subscription>) => ({ id: "s", name: "X", amount: 1200, currency: "INR", cycle: "Monthly", status: "Active", nextDate: "2026-10-20", ...s }) as Subscription;
  it("uses monthly equivalents for the run rate and full amounts for renewals due", () => {
    const r = subscriptionSummary([sub({}), sub({ id: "y", amount: 12_000, cycle: "Yearly", nextDate: "2026-10-15" }), sub({ id: "far", cycle: "Yearly", amount: 6000, nextDate: "2027-03-01" })], (s) => s.amount, NOW);
    expect(r.monthlyEquivalent).toBe(1200 + 1000 + 500);
    expect(r.active).toBe(3);
    expect(r.dueSoon.map((d) => [d.sub.id, d.amount])).toEqual([
      ["y", 12_000],
      ["s", 1200],
    ]);
  });
});

describe("cash flow", () => {
  const tx = (t: Partial<Transaction>) => ({ id: Math.random().toString(), date: "2026-10-02", amount: 1000, description: "", category: "food", type: "debit", ...t }) as Transaction;
  it("refuses to compute from mostly uncategorised transactions", () => {
    const r = cashFlowThisMonth([tx({ type: "credit", category: "uncategorized", amount: 900_000 }), tx({})], NOW);
    expect(r.status).toBe("unavailable");
  });
  const fullSeptember = Array.from({ length: 12 }, (_, i) => tx({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, category: i ? "food" : "salary", type: i ? "debit" : "credit" }));

  it("needs a complete previous month before showing a partial one", () => {
    const few = [tx({ type: "credit", category: "salary", amount: 85_000 }), tx({ amount: 450 })];
    expect(cashFlowThisMonth(few, NOW).status).toBe("unavailable");
    expect(cashFlowForMonth(few, "2026-10", false)).toMatchObject({ status: "unavailable" }); // 2 transactions isn't a month
    expect(cashFlowThisMonth([...fullSeptember, ...few], NOW).status).toBe("ok");
  });

  it("excludes transfers, loan proceeds and investments; shows loan payments separately", () => {
    const r = cashFlowThisMonth(
      [
        ...fullSeptember,
        tx({ type: "credit", category: "salary", amount: 100_000 }),
        tx({ type: "credit", category: "loan", amount: 500_000 }),
        tx({ category: "transfer", amount: 50_000 }),
        tx({ category: "investment", amount: 20_000 }),
        tx({ category: "loan emi", amount: 23_000 }),
        tx({ category: "food", amount: 10_000 }),
      ],
      NOW,
    );
    expect(r.status === "ok" && r.flow).toMatchObject({ income: 100_000, spending: 10_000, loanPayments: 23_000, surplus: 67_000, partial: true });
  });
});

describe("needs attention", () => {
  const a = (key: string, tier: 1 | 2 | 3, impact: number): Attention => ({ key, tier, impact, title: key, reason: "", action: "", href: "/" });
  it("orders by tier then amount and drops duplicates", () => {
    const r = rankAttention([a("stale", 3, 9e6), a("emi", 2, 2e6), a("overdue", 1, 1e4), a("emi", 2, 2e6), a("conn", 2, 6e6)]);
    expect(r.map((x) => x.key)).toEqual(["overdue", "conn", "emi", "stale"]);
  });
});

describe("cash events", () => {
  it("shows a loan with an unknown EMI as an unknown amount on the dashboard, never as a zero payment", () => {
    const { upcoming } = buildCashEvents({ loans: [loan({ emiAmount: 0 })], investments: [], bankBalances: [] }, 2, { unverifiedEmis: true });
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming.every((e) => e.kind === "emi" && e.amountStatus === "unknown")).toBe(true);
    // The Upcoming page keeps its behaviour
    expect(buildCashEvents({ loans: [loan({ emiAmount: 0 })], investments: [], bankBalances: [] }, 2).upcoming).toHaveLength(0);
  });
});
