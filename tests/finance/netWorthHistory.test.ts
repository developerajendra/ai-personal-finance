import { describe, expect, it } from "vitest";
import {
  assessCurrent,
  buildHistory,
  chartPoints,
  compare,
  contributions,
  coverageChanges,
  liveObservation,
  monthEnd,
  rangeStart,
  tableRows,
  snapshotClasses,
  type ClassValues,
  type CoverageRecords,
} from "@/shared/utils/netWorthHistory";
import type { FinancialSnapshot, Investment, Loan, Property } from "@/shared/types";

const NOW = new Date(2026, 9, 4, 10, 0); // 4 Oct 2026

const EMPTY: ClassValues = { bank: 0, stocks: 0, pf: 0, property: 0, recv: 0, fd: 0, investments: 0, loans: 0 };

/** A month-end snapshot saved `lagDays` after the month ended (recorded when ≤ 10). */
function snap(year: number, month: number | undefined, c: Partial<ClassValues>, lagDays = 1, over: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  const v = { ...EMPTY, ...c };
  const assets = v.bank + v.stocks + v.pf + v.property + v.recv + v.fd + v.investments;
  const saved = new Date(monthEnd(year, month ?? 12).getTime() + lagDays * 864e5).toISOString();
  return {
    id: `${year}-${month}-${lagDays}`,
    year,
    month,
    period: month ? "monthly" : "yearly",
    snapshotDate: monthEnd(year, month ?? 12).toISOString(),
    totalInvestments: v.fd + v.investments,
    totalLoans: v.loans,
    totalProperties: v.property,
    totalBankBalances: v.bank,
    totalReceivables: v.recv,
    totalStocks: v.stocks,
    totalMutualFunds: 0,
    totalPPF: v.pf,
    totalFixedAssets: v.property,
    totalLiquidAssets: assets - v.property,
    netWorth: assets - v.loans,
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    // As the snapshot calculator writes it: manual records by type, broker holdings merged into 'stocks'
    investmentBreakdown: { fd: v.fd, other: v.investments, stocks: v.stocks },
    loanBreakdown: {},
    propertyBreakdown: {},
    categoryBreakdown: {},
    createdAt: saved,
    updatedAt: saved,
    ...over,
  };
}

const live = (c: Partial<ClassValues>) => liveObservation({ ...EMPTY, ...c }, NOW);
const history = (snaps: FinancialSnapshot[]) => buildHistory(snaps, NOW).observations;

describe("ranges", () => {
  it("rolls 3M/6M back from today and starts YTD on 1 January", () => {
    expect(rangeStart("3M", NOW)).toEqual(new Date(2026, 6, 4));
    expect(rangeStart("6M", NOW)).toEqual(new Date(2026, 3, 4));
    expect(rangeStart("YTD", NOW)).toEqual(new Date(2026, 0, 1));
    expect(rangeStart("ALL", NOW)).toBeNull();
  });

  it("clamps month-end overflow (31 May − 3M → 28 Feb)", () => {
    expect(rangeStart("3M", new Date(2026, 4, 31))).toEqual(new Date(2026, 1, 28));
  });
});

describe("history", () => {
  it("sorts chronologically, keeps one row per month and drops unfinished months", () => {
    const h = buildHistory(
      [
        snap(2026, 3, { bank: 300 }),
        snap(2026, 1, { bank: 100 }),
        snap(2026, 2, { bank: 200 }, 1),
        snap(2026, 2, { bank: 250 }, 3), // saved later → wins
        snap(2026, 10, { bank: 999 }, -27), // October hasn't ended
      ],
      NOW,
    );
    expect(h.observations.map((o) => [o.key, o.netWorth])).toEqual([
      ["2026-01", 100],
      ["2026-02", 250],
      ["2026-03", 300],
    ]);
    expect(h.duplicates).toBe(1);
    expect(h.unfinished).toBe(1);
  });

  it("prefers a monthly December over a yearly row and keeps the other as an alternate", () => {
    const h = history([snap(2025, 12, { bank: 10 }), snap(2025, undefined, { bank: 20 }, 5)]);
    expect(h).toHaveLength(1);
    expect(h[0].netWorth).toBe(10);
    expect(h[0].alternates.map((a) => a.netWorth)).toEqual([20]);
    expect(h[0].conflict).toBe(true);
  });

  it("prefers a recorded save over an empty or rebuilt one for the same month, and never treats empty as zero", () => {
    const b = buildHistory(
      [snap(2026, 2, {}, 1, { id: "empty" }), snap(2026, 2, { bank: 500 }, 3, { id: "rec" }), snap(2026, 2, { bank: 900 }, 200, { id: "rebuilt" })],
      NOW,
    );
    expect(b.observations).toHaveLength(1);
    expect(b.observations[0].id).toBe("rec");
    expect(b.observations[0].alternates.map((a) => a.id).sort()).toEqual(["empty", "rebuilt"]);
    expect(b.duplicates).toBe(2);
    const onlyEmpty = buildHistory([snap(2026, 3, {}, 1)], NOW);
    expect(onlyEmpty.observations[0]).toMatchObject({ quality: "estimated", reason: "empty" });
    expect(onlyEmpty.empty).toBe(1);
    expect(compare(onlyEmpty.observations, live({ bank: 100 }), "YTD", NOW).status).toBe("insufficient");
  });

  it("orders by effective date even when year/month arrive as strings", () => {
    const h = history([snap(2026, 9, { bank: 9 }), { ...snap(2026, 4, { bank: 4 }), month: "4" as any, year: "2026" as any }]);
    expect(h.map((o) => o.key)).toEqual(["2026-04", "2026-09"]);
  });

  it("marks snapshots rebuilt long after month-end, or saved before it ended, as estimated", () => {
    const [rebuilt, early, recorded] = history([
      snap(2026, 1, { bank: 1 }, 245),
      snap(2026, 2, { bank: 1 }, -10),
      snap(2026, 3, { bank: 1 }, 2),
    ]);
    expect([rebuilt.quality, rebuilt.reason]).toEqual(["estimated", "rebuilt"]);
    expect([early.quality, early.reason]).toEqual(["estimated", "early"]);
    expect(recorded.quality).toBe("recorded");
  });
});

describe("categories", () => {
  it("files manual stock and fund records under Stocks & funds, as Portfolio does", () => {
    // Broker holdings 68,24,577 + a manual mutual-fund record 5,50,000 → Stocks & funds 73,74,577
    const s = snap(2026, 9, {}, 1, {
      totalStocks: 1_116_366,
      totalMutualFunds: 5_708_211,
      totalInvestments: 550_000 + 33_333 + 400_000,
      investmentBreakdown: { stocks: 1_116_366, "mutual-fund": 5_708_211 + 550_000, nps: 33_333, fd: 400_000 },
    });
    const c = snapshotClasses(s);
    expect(c.split).toBe(true);
    expect(c.stocks).toBe(7_374_577);
    expect(c.pf).toBe(33_333);
    expect(c.fd).toBe(400_000);
    expect(c.investments).toBe(0);
  });

  it("keeps an unsplittable total whole rather than guessing", () => {
    const c = snapshotClasses(snap(2026, 9, {}, 1, { totalInvestments: 1000, investmentBreakdown: {} }));
    expect([c.split, c.investments, c.fd]).toEqual([false, 1000, 0]);
  });
});

describe("period comparison", () => {
  it("YTD compares today with the recorded 31 December value", () => {
    const h = history([snap(2025, 12, { bank: 1000 }), snap(2026, 6, { bank: 1100 })]);
    const c = compare(h, live({ bank: 1200 }), "YTD", NOW);
    expect(c.status).toBe("ok");
    if (c.status !== "ok") return;
    expect(c.opening.key).toBe("2025-12");
    expect(c.change).toBe(200);
    expect(c.pct).toBeCloseTo(20);
    expect(c.later).toBe(false);
  });

  it("anchors the closing value to today regardless of range", () => {
    const h = history([snap(2025, 12, { bank: 1000 }), snap(2026, 3, { bank: 900 }), snap(2026, 6, { bank: 1100 })]);
    const today = live({ bank: 1200 });
    for (const r of ["3M", "6M", "YTD", "ALL"] as const) {
      const c = compare(h, today, r, NOW);
      expect(c.status === "ok" && c.closing.netWorth).toBe(1200);
    }
    const six = compare(h, today, "6M", NOW);
    expect(six.status === "ok" && six.opening.key).toBe("2026-03"); // 31 Mar ≤ 4 Apr
  });

  it("never opens from an estimate, and discloses a later comparison date", () => {
    const h = history([snap(2025, 12, { bank: 1000 }, 200), snap(2026, 4, { bank: 1050 })]);
    const c = compare(h, live({ bank: 1200 }), "YTD", NOW);
    expect(c.status).toBe("ok");
    if (c.status !== "ok") return;
    expect(c.opening.key).toBe("2026-04");
    expect(c.later).toBe(true);
  });

  it("does not stretch the period to an opening far before the start", () => {
    const h = history([snap(2026, 1, { bank: 1000 })]);
    expect(compare(h, live({ bank: 1200 }), "3M", NOW)).toMatchObject({ status: "insufficient", reason: "no-history" });
  });

  it("reports insufficient history instead of inventing a change", () => {
    expect(compare([], live({ bank: 5 }), "YTD", NOW)).toMatchObject({ status: "insufficient", reason: "no-history" });
    const onlyRebuilt = history([snap(2026, 1, { bank: 1 }, 240), snap(2026, 9, { bank: 1 }, 3, { createdAt: undefined as any, updatedAt: undefined as any })]);
    expect(compare(onlyRebuilt, live({ bank: 5 }), "YTD", NOW)).toMatchObject({ status: "insufficient", reason: "only-estimates" });
  });

  it("gives no percentage when the opening net worth is zero or negative", () => {
    const neg = history([snap(2025, 12, { bank: 100, loans: 500 })]);
    const c = compare(neg, live({ bank: 300, loans: 450 }), "YTD", NOW);
    expect(c.status === "ok" && [c.change, c.pct]).toEqual([250, null]);
    const zero = history([snap(2025, 12, { bank: 100, loans: 100 })]); // genuine zero, not an empty save
    const z = compare(zero, live({ bank: 300 }), "YTD", NOW);
    expect(z.status === "ok" && z.pct).toBeNull();
  });

  it("treats a transfer between tracked accounts as no change", () => {
    const h = history([snap(2025, 12, { bank: 500_000, investments: 100_000 })]);
    const c = compare(h, live({ bank: 300_000, investments: 300_000 }), "YTD", NOW);
    expect(c.status === "ok" && c.change).toBe(0);
  });

  it("counts principal repayment as cash down and loan down — no net gain", () => {
    const h = history([snap(2025, 12, { bank: 500_000, property: 5_000_000, loans: 2_000_000 })]);
    const c = compare(h, live({ bank: 400_000, property: 5_000_000, loans: 1_900_000 }), "YTD", NOW);
    expect(c.status === "ok" && c.change).toBe(0);
  });
});

describe("coverage", () => {
  const opening = history([snap(2025, 12, { stocks: 130_000 })])[0];
  const records = (over: Partial<CoverageRecords> = {}): CoverageRecords => ({
    investments: [],
    loans: [],
    properties: [],
    receivables: [],
    ppfAccounts: [],
    investmentValue: (i) => i.amount,
    receivableValue: (r) => r.balance,
    ...over,
  });
  const prop = (p: Partial<Property>) => ({ id: "p", name: "House", purchasePrice: 4_000_000, currentValue: 8_500_000, purchaseDate: "2015-01-01", createdAt: "2026-10-03", ...p }) as Property;
  const loan = (l: Partial<Loan>) => ({ id: "l", name: "Home", outstandingAmount: 2_000_000, startDate: "2020-01-01", createdAt: "2026-10-03", status: "active", ...l }) as Loan;

  it("flags accounts held before the opening but missing from it as newly tracked, not growth", () => {
    const today = live({ stocks: 130_000, property: 8_500_000, pf: 3_100_000, loans: 2_000_000 });
    const items = coverageChanges(opening, today, records({ properties: [prop({})], loans: [loan({})], ppfAccounts: [{ id: "e", grandTotal: 3_100_000 } as any] }));
    expect(items).toEqual(
      expect.arrayContaining([
        { cls: "property", amount: 8_500_000, basis: "held-before" },
        { cls: "pf", amount: 3_100_000, basis: "held-before" },
        { cls: "loans", amount: -2_000_000, basis: "held-before" },
      ]),
    );
  });

  it("keeps a loan or deposit started inside the period as ordinary change", () => {
    const today = live({ stocks: 130_000, fd: 500_000, loans: 2_000_000 });
    const inv = { id: "i", name: "FD", type: "fd", amount: 500_000, startDate: "2026-05-01", createdAt: "2026-05-01" } as Investment;
    const items = coverageChanges(opening, today, records({ investments: [inv], loans: [loan({ startDate: "2026-03-01" })] }));
    expect(items).toEqual([]);
  });

  it("reports an empty class with no start dates as unknown", () => {
    const items = coverageChanges(opening, live({ stocks: 130_000, bank: 400_000 }), records());
    expect(items).toEqual([{ cls: "bank", amount: 400_000, basis: "unknown" }]);
  });
});

describe("chart points", () => {
  it("leaves months without a snapshot as gaps, never zero", () => {
    const h = history([snap(2025, 12, { bank: 100 }), snap(2026, 2, { bank: 120 })]);
    const pts = chartPoints(h, live({ bank: 130 }), "YTD", NOW, h[0]);
    const jan = pts.find((p) => p.key === "2026-01")!;
    expect(jan.netWorth).toBeNull();
    expect(jan.solid).toBeNull();
    expect(pts.map((p) => p.key)).toEqual(["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "today"]);
  });

  it("gives every slot a unique label and shows the year where it changes", () => {
    const h = history([snap(2025, 12, { bank: 100 })]);
    const labels = chartPoints(h, live({ bank: 130 }), "YTD", NOW, h[0]).map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.slice(0, 2)).toEqual(["Dec '25", "Jan '26"]);
    expect(labels.at(-1)).toBe("Today");
  });

  it("draws recorded→recorded solid, anything touching an estimate dashed, and keeps declines", () => {
    const h = history([snap(2026, 6, { bank: 100 }), snap(2026, 7, { bank: 60 }), snap(2026, 8, { bank: 80 }, 60), snap(2026, 9, { bank: 90 })]);
    const pts = chartPoints(h, live({ bank: 95 }), "3M", NOW, h[0]);
    const by = Object.fromEntries(pts.map((p) => [p.key, p]));
    expect([by["2026-06"].solid, by["2026-07"].solid]).toEqual([100, 60]); // the drop stays
    expect([by["2026-07"].dashed, by["2026-08"].dashed, by["2026-09"].dashed]).toEqual([60, 80, 90]);
    expect(by.today.solid).toBe(95);
  });

  it("breaks the line where accounts first appear instead of drawing it as growth", () => {
    const h = history([snap(2026, 9, { stocks: 130_000 })]);
    const pts = chartPoints(h, live({ stocks: 130_000, property: 8_500_000 }), "3M", NOW);
    const today = pts.at(-1)!;
    expect(today.coverageBreak).toBe(true);
    expect(today.solid).toBeNull();
    expect(today.netWorth).toBe(8_630_000);
  });

  it("still charts estimated months before a later opening", () => {
    const h = history([snap(2025, 12, { bank: 90 }, 200), snap(2026, 1, { bank: 95 }, 200), snap(2026, 9, { bank: 100 })]);
    const c = compare(h, live({ bank: 110 }), "YTD", NOW);
    const pts = chartPoints(h, live({ bank: 110 }), "YTD", NOW, c.status === "ok" ? c.opening : undefined);
    expect(c.status === "ok" && c.opening.key).toBe("2026-09");
    expect(pts[0]).toMatchObject({ key: "2025-12", netWorth: 90, quality: "estimated" });
  });

  it("uses year-end slots for very long histories", () => {
    const h = history([snap(2019, undefined, { bank: 10 }), snap(2022, undefined, { bank: 20 })]);
    const pts = chartPoints(h, live({ bank: 30 }), "ALL", NOW);
    expect(pts.map((p) => p.key)).toEqual(["2019-12", "2020-12", "2021-12", "2022-12", "2023-12", "2024-12", "2025-12", "today"]);
    expect(pts[1].netWorth).toBeNull();
  });
});

describe("current value quality", () => {
  it("flags material stale balances, property estimates and missing loan balances", () => {
    const { issues } = assessCurrent({
      cashAccounts: [
        { id: "a", bankName: "Old", balance: 500_000, lastUpdated: "2022-01-01" } as any,
        { id: "b", bankName: "New", balance: 1_000, lastUpdated: "2026-10-01" } as any,
      ],
      loans: [{ id: "l", outstandingAmount: NaN, updatedAt: "2026-10-01" } as any],
      properties: [{ id: "p", currentValue: 8_500_000, purchasePrice: 4_000_000, updatedAt: "2026-10-03" } as any],
      ppfAccounts: [],
      marketValue: 0,
      marketLive: undefined,
      assets: 9_001_000,
      liabilities: 0,
      now: NOW,
    });
    expect(issues.map((i) => [i.source, i.kind, i.material])).toEqual([
      ["Bank balances", "stale", true],
      ["Loans", "missing", true],
      ["Properties", "estimated", true],
    ]);
    expect(issues[0].amount).toBe(500_000); // only the stale account
  });

  it("reports nothing when every balance is fresh and measured", () => {
    const { issues } = assessCurrent({
      cashAccounts: [{ id: "b", balance: 1_000, lastUpdated: "2026-10-01" } as any],
      loans: [],
      properties: [],
      ppfAccounts: [],
      marketValue: 5_000,
      marketLive: true,
      assets: 6_000,
      liabilities: 0,
      now: NOW,
    });
    expect(issues).toEqual([]);
  });
});

describe("contributions", () => {
  it("sum to the net-worth change, with loans counted against it", () => {
    const [o] = history([snap(2025, 12, { bank: 500_000, stocks: 1_000_000, property: 5_000_000, loans: 2_000_000 })]);
    const c = live({ bank: 400_000, stocks: 1_200_000, property: 5_000_000, loans: 1_900_000 });
    const r = contributions(o, c);
    const by = Object.fromEntries(r.rows.map((x) => [x.cls, x]));
    expect(by.loans).toMatchObject({ balanceChange: -100_000, contribution: 100_000 });
    expect(by.bank.contribution).toBe(-100_000); // the repayment came out of cash: nets to zero with the loan row
    expect(r.change).toBe(200_000);
    expect(r.total).toBe(200_000);
    expect(r.residual).toBe(0);
  });

  it("splits newly tracked value out and flags categories that first appear", () => {
    const [o] = history([snap(2025, 12, { stocks: 130_000 })]);
    const c = live({ stocks: 130_000, property: 8_500_000 });
    const r = contributions(o, c, [{ cls: "property", amount: 8_500_000, basis: "held-before" }]);
    const p = r.rows.find((x) => x.cls === "property")!;
    expect(p).toMatchObject({ contribution: 8_500_000, newlyTracked: 8_500_000, unclassified: 0, firstAppears: true });
  });

  it("reports an inconsistent snapshot as a residual instead of hiding it", () => {
    const [o] = history([snap(2025, 12, { bank: 1000 }, 1, { netWorth: 900 })]);
    const r = contributions(o, live({ bank: 1000 }));
    expect(r.residual).toBe(100);
  });
});

describe("table rows", () => {
  it("lists Today first, then months newest first — never an older month straight after Today", () => {
    const h = history([snap(2026, 1, { bank: 1 }), snap(2026, 4, { bank: 4 }), snap(2026, 9, { bank: 9 })]);
    const rows = tableRows(h, live({ bank: 10 }), "monthly", NOW);
    expect(rows.map((r) => r.key)).toEqual(["today", "2026-09", "2026-08", "2026-07", "2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01"]);
    expect(rows[0].prev?.key).toBe("2026-09");
  });

  it("keeps gaps as rows and compares with the latest earlier month that has data", () => {
    const h = history([snap(2026, 1, { bank: 1 }), snap(2026, 2, {}), snap(2026, 4, { bank: 4 })]);
    const rows = tableRows(h, live({ bank: 10 }), "monthly", NOW);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by["2026-03"].obs).toBeNull();
    expect(by["2026-04"].prev?.key).toBe("2026-01"); // skips the gap and the empty February save
    expect(by["2026-04"].prevSkipped).toBe(true);
    expect(by["2026-02"].obs?.reason).toBe("empty");
  });

  it("compares year-ends with the previous year-end", () => {
    const h = history([snap(2024, undefined, { bank: 1 }), snap(2025, 12, { bank: 2 }), snap(2026, 6, { bank: 3 })]);
    const rows = tableRows(h, live({ bank: 4 }), "yearly", NOW);
    expect(rows.map((r) => r.key)).toEqual(["today", "2025-12", "2024-12"]);
    expect(rows[1].prev?.key).toBe("2024-12");
    expect(rows[0].prev?.key).toBe("2025-12");
  });
});
