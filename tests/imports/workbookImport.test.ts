import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createUser } from "../helpers";
import { importLedgerWorkbook, isLedgerWorkbook, parseLedgerWorkbook, ruleToFormula, toISODate } from "@/server/imports/workbookImport";
import { buildPortfolioWorkbook } from "@/server/imports/workbookExport";
import { listInvestments } from "@/server/finance/investments/service";
import { listTransactions } from "@/server/finance/transactions/service";
import { loadPortfolio, loadStocks, loadMutualFunds } from "@/server/finance/portfolio/service";
import { loadPPFAccounts } from "@/server/finance/provident-fund/ppfStorage";
import { getCurrentInvestmentValue } from "@/shared/utils/investmentValue";

const serial = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime() / 864e5 + 25569;

/** Synthetic workbook in the Ledger export format (same sheet + column names). */
function sampleWorkbook() {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[][]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  add("Summary", [["Category", "Amount (₹)"], ["Bank Balances", 1]]);
  add("Investments", [
    ["Name", "Type", "Asset Type", "Amount (₹)", "Currency", "Interest Rate (%)", "Status", "Start Date", "Maturity Date", "Maturity Amount (₹)", "Rule", "Description", "Tags"],
    ["Nepal FD", "fd", "", 625000, "NPR", "", "active", serial("2022-01-01"), serial("2034-01-01"), 3125000, "5x in 12 years", "", ""],
    ["PPF Account", "ppf", "liquid", 1400000, "INR", 7.5, "active", serial("2026-01-07"), "", 0, "", "", ""],
  ]);
  add("Bank Balances & Receivables", [
    ["Bank Name", "Account Number", "Account Type", "Balance (₹)", "Currency", "Interest Rate (%)", "Status", "Last Updated", "Issue Date", "Due Date", "Description", "Tags"],
    ["Nepal Account", "", "savings", 31250, "NPR", "", "active", serial("2022-01-01"), "", "", "", ""],
    ["Icici", "", "savings", 150000, "INR", "", "active", serial("2026-01-09"), "", "", "", ""],
    ["─── Receivables ───", "", "", "", "", "", "", "", "", "", "", ""],
    ["Himal", "", "other", 625000, "NPR", 12, "active", serial("2026-01-09"), serial("2025-09-06"), serial("2026-09-06"), "", "receivable"],
  ]);
  add("Loans", [
    ["Name", "Type", "Principal (₹)", "Outstanding (₹)", "EMI Amount (₹)", "EMI Date", "Interest Rate (%)", "Tenure (Months)", "Status", "Start Date", "End Date", "Description"],
    ["House Loan", "home-loan", 2000000, 1900000, 28597, 5, 6.75, 120, "active", serial("2026-01-02"), "", ""],
  ]);
  add("Properties", [
    ["Name", "Type", "Asset Type", "Purchase Price (₹)", "Current Value (₹)", "Purchase Date", "Location", "Status", "Description"],
    ["House", "house", "", 4000000, 8500000, serial("2018-01-01"), "Greater Noida West", "owned", ""],
  ]);
  add("Stocks", [
    ["Symbol", "Exchange", "Quantity", "Avg Price (₹)", "Last Price (₹)", "Current Value (₹)", "P&L (₹)", "P&L (%)"],
    ["TCS", "NSE", 5, 3450, 3520.25, 17601.25, 351.25, 2.04],
    ["INFY", "NSE", 8, 1520.5, 1480.25, 11842, -322, -2.65],
  ]);
  add("Mutual Funds", [
    ["Symbol", "Fund Name", "Folio", "Quantity", "Avg Price (₹)", "Last Price (₹)", "Current Value (₹)", "P&L (₹)", "P&L (%)"],
    ["INF200K01QX4", "SBI Fund", "23896073", 100, 90, 97, 9700, 700, 7.78],
  ]);
  add("Provident Fund", [
    ["Member ID", "Member Name", "Establishment ID", "Establishment Name", "Employee Share (₹)", "Employer Share (₹)", "Grand Total (₹)", "Last Updated"],
    ["MRNOI001", "TEST USER", "MRNOI/TO", "TTN", 1268878, 1074082, 2454169, serial("2026-03-21")],
  ]);
  add("Transactions", [
    ["Date", "Description", "Category", "Type", "Amount (₹)", "Balance (₹)", "Account", "Source"],
    [serial("2026-01-02") + 0.64, "Salary", "Salary", "credit", 245000, 0, "", "excel"],
    [serial("2026-01-05"), "Rent", "Housing", "debit", 30000, 0, "", "excel"],
  ]);
  return wb;
}

describe("Ledger workbook import", () => {
  it("recognises the export format and parses helpers", () => {
    expect(isLedgerWorkbook(sampleWorkbook())).toBe(true);
    expect(isLedgerWorkbook(XLSX.utils.book_new())).toBe(false);
    expect(toISODate(serial("2026-01-02") + 0.64)).toBe("2026-01-02");
    expect(toISODate("06/09/2026")).toBe("2026-09-06");
    expect(ruleToFormula("4x in 14 Years")).toBe("principal * Math.pow(4, yearsElapsed / 14)");
    expect(ruleToFormula("2x In 6 Year")).toBe("principal * Math.pow(2, yearsElapsed / 6)");
    expect(ruleToFormula("custom")).toBeUndefined();
  });

  it("converts ₹ columns back to the original currency so values aren't converted twice", () => {
    const parsed = parseLedgerWorkbook(sampleWorkbook());
    const fd = parsed.investments.find((i) => i.name === "Nepal FD")!;
    expect(fd.originalCurrency).toBe("NPR");
    expect(fd.originalAmount).toBeCloseTo(1000000, 2); // ₹6,25,000 ÷ 0.625
    expect(parsed.bankBalances).toHaveLength(3); // separator row skipped
    expect(parsed.bankBalances.find((b) => b.bankName === "Himal")?.tags).toEqual(["receivable"]);
  });

  it("imports every sheet as published records, and re-importing adds nothing", async () => {
    const user = await createUser();
    const first = await importLedgerWorkbook(user, sampleWorkbook());
    expect(first.added).toEqual({ investments: 2, loans: 1, properties: 1, bankBalances: 3 });
    expect(first.transactions.inserted).toBe(2);
    expect(first.holdings).toEqual({ stocks: 2, mutualFunds: 1, ppfAccounts: 1 });

    const invs = await listInvestments(user);
    expect(invs.every((i) => i.isPublished)).toBe(true);
    // Principal of the NPR deposit is ₹6,25,000 at start (not ₹3,90,625 from double conversion)
    const fd = invs.find((i) => i.name === "Nepal FD")!;
    const atStart = getCurrentInvestmentValue({ ...fd, ruleFormula: undefined });
    expect(atStart).toBeCloseTo(625000, 0);
    expect(fd.ruleFormula).toContain("Math.pow(5");

    expect(await loadStocks(user)).toHaveLength(2);
    expect(await loadMutualFunds(user)).toHaveLength(1);
    expect((await loadPPFAccounts(user))[0]?.grandTotal).toBe(2454169);

    const again = await importLedgerWorkbook(user, sampleWorkbook());
    expect(again.added).toEqual({ investments: 0, loans: 0, properties: 0, bankBalances: 0 });
    expect(again.transactions.inserted).toBe(0);
    expect(await loadPPFAccounts(user)).toHaveLength(1); // upserted by member ID
    expect(await listTransactions(user)).toHaveLength(2);
  });

  it("export → import round-trips into an empty account", async () => {
    const source = await createUser();
    await importLedgerWorkbook(source, sampleWorkbook());
    const exported = XLSX.read(await buildPortfolioWorkbook(source), { type: "buffer" });
    expect(isLedgerWorkbook(exported)).toBe(true);

    const target = await createUser();
    await importLedgerWorkbook(target, exported);
    const a = await loadPortfolio(source);
    const b = await loadPortfolio(target);
    const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
    expect(sum(b.bankBalances.map((x) => x.balance))).toBeCloseTo(sum(a.bankBalances.map((x) => x.balance)), 2);
    expect(sum(b.investments.map(getCurrentInvestmentValue))).toBeCloseTo(sum(a.investments.map(getCurrentInvestmentValue)), 0);
    expect(b.loans.map((l) => l.outstandingAmount)).toEqual(a.loans.map((l) => l.outstandingAmount));
    expect(b.transactions).toHaveLength(a.transactions.length);
  });
});
