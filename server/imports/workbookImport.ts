import "server-only";
import * as XLSX from "xlsx";
import type { BankBalance, Investment, Loan, PPFAccount, Property, Transaction, ZerodhaMutualFund, ZerodhaStock } from "@/shared/types";
import { INVESTMENT_TYPES } from "@/shared/schemas/finance";
import { convertFromINR, type Currency } from "@/shared/utils/currency";
import { importPortfolio, type PortfolioImportResult } from "@/server/imports/portfolioImport";
import { loadStocks, loadMutualFunds, saveStocks, saveMutualFunds } from "@/server/finance/portfolio/service";
import { loadPPFAccounts, savePPFAccounts } from "@/server/finance/provident-fund/ppfStorage";

/**
 * Deterministic importer for the portfolio workbook (the multi-sheet
 * "portfolio-export-YYYY-MM-DD.xlsx" format: Investments, Bank Balances
 * & Receivables, Loans, Properties, Stocks, Mutual Funds, Provident Fund,
 * Transactions; the export's other sheets — Summary, Categories, history,
 * budget — are informational and ignored here). Columns are known, so no AI is involved and every row maps
 * 1:1 to a record. Amount columns are in ₹; rows in another currency are
 * converted back to their original amount so values aren't converted twice.
 */

export const WORKBOOK_SHEETS = {
  investments: "Investments",
  bank: "Bank Balances & Receivables",
  loans: "Loans",
  properties: "Properties",
  stocks: "Stocks",
  funds: "Mutual Funds",
  pf: "Provident Fund",
  transactions: "Transactions",
} as const;

type Row = Record<string, unknown>;

/** A workbook is a portfolio export when at least two of its known sheets are present. */
export function isPortfolioWorkbook(wb: XLSX.WorkBook) {
  const names = new Set(wb.SheetNames);
  return Object.values(WORKBOOK_SHEETS).filter((n) => names.has(n)).length >= 2;
}

function rows(wb: XLSX.WorkBook, sheet: string): Row[] {
  const ws = wb.Sheets[sheet];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: null, raw: true });
}

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const optStr = (v: unknown) => str(v) || undefined;
/** Rows exported as drafts ("Published: No") come back as drafts; anything else is published. */
const published = (r: Row) => str(r["Published"]).toLowerCase() !== "no";

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

/** Excel serial date, ISO string or d/m/y text → yyyy-mm-dd */
export function toISODate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") {
    if (v > 1900 && v < 2200 && Number.isInteger(v)) return `${v}-01-01`; // bare year
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return undefined;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

const CURRENCIES: Currency[] = ["INR", "NPR", "USD"];
const currencyOf = (v: unknown): Currency => {
  const c = str(v).toUpperCase() as Currency;
  return CURRENCIES.includes(c) ? c : "INR";
};

/** "5x in 12 years" → growth formula the value calculator understands */
export function ruleToFormula(rule: string): string | undefined {
  const m = rule.match(/(\d+(?:\.\d+)?)\s*x\s*in\s*(\d+(?:\.\d+)?)\s*y(?:ea)?rs?/i);
  if (!m) return undefined;
  return `principal * Math.pow(${Number(m[1])}, yearsElapsed / ${Number(m[2])})`;
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => {
  const s = str(v).toLowerCase() as T;
  return allowed.includes(s) ? s : fallback;
};

export interface WorkbookImportResult extends PortfolioImportResult {
  holdings: { stocks: number; mutualFunds: number; ppfAccounts: number };
}

export function parsePortfolioWorkbook(wb: XLSX.WorkBook) {
  const investments: Partial<Investment>[] = rows(wb, WORKBOOK_SHEETS.investments)
    .filter((r) => str(r["Name"]))
    .map((r) => {
      const ccy = currencyOf(r["Currency"]);
      const amountInr = num(r["Amount (₹)"]) ?? 0;
      const maturityInr = num(r["Maturity Amount (₹)"]);
      const rule = str(r["Rule"]);
      return {
        name: str(r["Name"]),
        type: pick(r["Type"], INVESTMENT_TYPES, "other"),
        assetType: (pick(r["Asset Type"], ["fixed", "liquid", ""] as const, "") || undefined) as Investment["assetType"],
        amount: amountInr,
        currency: ccy,
        originalAmount: ccy === "INR" ? undefined : convertFromINR(amountInr, ccy),
        originalCurrency: ccy === "INR" ? undefined : ccy,
        interestRate: num(r["Interest Rate (%)"]),
        compoundingMonths: num(r["Compounding (Months)"]),
        status: pick(r["Status"], ["active", "matured", "closed"] as const, "active"),
        startDate: toISODate(r["Start Date"]) ?? new Date().toISOString().slice(0, 10),
        maturityDate: toISODate(r["Maturity Date"]),
        maturityAmount: maturityInr ? maturityInr : undefined,
        originalMaturityAmount: maturityInr && ccy !== "INR" ? convertFromINR(maturityInr, ccy) : undefined,
        ruleLabel: rule || undefined,
        ruleFormula: rule ? ruleToFormula(rule) : undefined,
        description: optStr(r["Description"]),
        tags: str(r["Tags"]) ? str(r["Tags"]).split(/[,;]\s*/).filter(Boolean) : undefined,
        isPublished: published(r),
      };
    });

  const bankBalances: Partial<BankBalance>[] = rows(wb, WORKBOOK_SHEETS.bank)
    .filter((r) => str(r["Bank Name"]) && !/^[─—-]{2,}/.test(str(r["Bank Name"])))
    .map((r) => {
      const ccy = currencyOf(r["Currency"]);
      const balanceInr = num(r["Balance (₹)"]) ?? 0;
      const tags = str(r["Tags"]) ? str(r["Tags"]).split(/[,;]\s*/).filter(Boolean) : [];
      return {
        bankName: str(r["Bank Name"]),
        accountNumber: optStr(r["Account Number"]),
        accountType: pick(r["Account Type"], ["savings", "current", "salary", "fd", "rd", "other"] as const, "other"),
        balance: balanceInr,
        currency: ccy,
        originalAmount: ccy === "INR" ? undefined : convertFromINR(balanceInr, ccy),
        originalCurrency: ccy === "INR" ? undefined : ccy,
        interestRate: num(r["Interest Rate (%)"]),
        status: pick(r["Status"], ["active", "closed", "dormant"] as const, "active"),
        lastUpdated: toISODate(r["Last Updated"]),
        issueDate: toISODate(r["Issue Date"]),
        dueDate: toISODate(r["Due Date"]),
        paidDate: toISODate(r["Paid Date"]),
        description: optStr(r["Description"]),
        tags: tags.length ? tags : undefined,
        isPublished: published(r),
      };
    });

  const loans: Partial<Loan>[] = rows(wb, WORKBOOK_SHEETS.loans)
    .filter((r) => str(r["Name"]))
    .map((r) => ({
      name: str(r["Name"]),
      type: pick(r["Type"], ["home-loan", "car-loan", "personal-loan", "education-loan", "other"] as const, "other"),
      principalAmount: num(r["Principal (₹)"]) ?? 0,
      outstandingAmount: num(r["Outstanding (₹)"]) ?? 0,
      emiAmount: num(r["EMI Amount (₹)"]) ?? 0,
      emiDate: Math.min(31, Math.max(1, Math.round(num(r["EMI Date"]) ?? 1))),
      interestRate: num(r["Interest Rate (%)"]) ?? 0,
      tenureMonths: Math.round(num(r["Tenure (Months)"]) ?? 0),
      status: pick(r["Status"], ["active", "closed", "foreclosed"] as const, "active"),
      startDate: toISODate(r["Start Date"]) ?? new Date().toISOString().slice(0, 10),
      endDate: toISODate(r["End Date"]),
      description: optStr(r["Description"]),
      isPublished: published(r),
    }));

  const properties: Partial<Property>[] = rows(wb, WORKBOOK_SHEETS.properties)
    .filter((r) => str(r["Name"]))
    .map((r) => ({
      name: str(r["Name"]),
      type: pick(r["Type"], ["house", "plot", "apartment", "commercial", "land", "other"] as const, "other"),
      assetType: (pick(r["Asset Type"], ["fixed", "liquid", ""] as const, "") || undefined) as Property["assetType"],
      purchasePrice: num(r["Purchase Price (₹)"]) ?? 0,
      currentValue: num(r["Current Value (₹)"]),
      purchaseDate: toISODate(r["Purchase Date"]) ?? new Date().toISOString().slice(0, 10),
      location: str(r["Location"]),
      status: pick(r["Status"], ["owned", "rented-out", "under-construction"] as const, "owned"),
      description: optStr(r["Description"]),
      isPublished: published(r),
    }));

  const stocks: ZerodhaStock[] = rows(wb, WORKBOOK_SHEETS.stocks)
    .filter((r) => str(r["Symbol"]))
    .map((r) => {
      const quantity = num(r["Quantity"]) ?? 0;
      const average_price = num(r["Avg Price (₹)"]) ?? 0;
      const last_price = num(r["Last Price (₹)"]) ?? 0;
      const pnl = num(r["P&L (₹)"]) ?? (last_price - average_price) * quantity;
      return {
        tradingsymbol: str(r["Symbol"]),
        exchange: str(r["Exchange"]) || "NSE",
        instrument_token: `${str(r["Exchange"]) || "NSE"}:${str(r["Symbol"])}`,
        quantity,
        average_price,
        last_price,
        pnl,
        pnl_percentage: num(r["P&L (%)"]) ?? (average_price ? ((last_price - average_price) / average_price) * 100 : 0),
      };
    });

  const mutualFunds: ZerodhaMutualFund[] = rows(wb, WORKBOOK_SHEETS.funds)
    .filter((r) => str(r["Symbol"]) || str(r["Fund Name"]))
    .map((r) => {
      const quantity = num(r["Quantity"]) ?? 0;
      const average_price = num(r["Avg Price (₹)"]) ?? 0;
      const last_price = num(r["Last Price (₹)"]) ?? 0;
      return {
        tradingsymbol: str(r["Symbol"]) || str(r["Fund Name"]),
        fund_name: str(r["Fund Name"]) || str(r["Symbol"]),
        folio: str(r["Folio"]),
        quantity,
        average_price,
        last_price,
        pnl: num(r["P&L (₹)"]) ?? (last_price - average_price) * quantity,
        pnl_percentage: num(r["P&L (%)"]) ?? (average_price ? ((last_price - average_price) / average_price) * 100 : 0),
      };
    });

  const ppfAccounts: Omit<PPFAccount, "id">[] = rows(wb, WORKBOOK_SHEETS.pf)
    .filter((r) => str(r["Member ID"]) || str(r["Establishment Name"]))
    .map((r) => {
      const updated = toISODate(r["Last Updated"]) ?? new Date().toISOString().slice(0, 10);
      return {
        memberId: optStr(r["Member ID"]),
        memberName: optStr(r["Member Name"]),
        establishmentId: optStr(r["Establishment ID"]),
        establishmentName: optStr(r["Establishment Name"]),
        depositEmployeeShare: num(r["Employee Share (₹)"]) ?? 0,
        depositEmployerShare: num(r["Employer Share (₹)"]) ?? 0,
        withdrawEmployeeShare: 0,
        withdrawEmployerShare: 0,
        pensionContribution: 0,
        grandTotal: num(r["Grand Total (₹)"]) ?? 0,
        extractedFrom: "portfolio-workbook",
        extractedAt: updated,
        lastUpdated: updated,
      };
    });

  const transactions = rows(wb, WORKBOOK_SHEETS.transactions)
    .filter((r) => str(r["Description"]) && toISODate(r["Date"]))
    .map((r) => ({
      date: toISODate(r["Date"])!,
      description: str(r["Description"]),
      category: str(r["Category"]) || "uncategorized",
      type: (str(r["Type"]).toLowerCase() === "credit" ? "credit" : "debit") as Transaction["type"],
      amount: Math.abs(num(r["Amount (₹)"]) ?? 0),
      balance: num(r["Balance (₹)"]) || undefined,
      account: optStr(r["Account"]),
    }));

  return { investments, bankBalances, loans, properties, stocks, mutualFunds, ppfAccounts, transactions };
}

/**
 * Import a portfolio workbook. Portfolio records are merged (existing records kept,
 * duplicates skipped) and published so they count immediately. Broker holdings
 * replace the cached Zerodha snapshot; EPF accounts upsert by member ID.
 */
export async function importPortfolioWorkbook(userId: string, wb: XLSX.WorkBook): Promise<WorkbookImportResult> {
  const parsed = parsePortfolioWorkbook(wb);

  const result = await importPortfolio(
    userId,
    { investments: parsed.investments, loans: parsed.loans, properties: parsed.properties, bankBalances: parsed.bankBalances },
    { source: "excel", rows: parsed.transactions }
  );

  if (parsed.stocks.length > 0) await saveStocks(userId, parsed.stocks);
  if (parsed.mutualFunds.length > 0) await saveMutualFunds(userId, parsed.mutualFunds);

  if (parsed.ppfAccounts.length > 0) {
    const existing = await loadPPFAccounts(userId);
    const accounts: PPFAccount[] = parsed.ppfAccounts.map((a) => {
      const match = existing.find((e) => (a.memberId && e.memberId === a.memberId) || (!a.memberId && e.establishmentName === a.establishmentName));
      // ids are a global primary key, so scope generated ones to the user
      return { ...a, id: match?.id ?? `ppf-${userId.slice(0, 12)}-${(a.memberId || a.establishmentName || "account").replace(/[^A-Za-z0-9]/g, "")}` };
    });
    await savePPFAccounts(userId, accounts);
  }

  // Fall back to existing counts so the summary reflects what the user now holds.
  const [stocksNow, fundsNow] = await Promise.all([loadStocks(userId), loadMutualFunds(userId)]);
  return {
    ...result,
    holdings: { stocks: stocksNow.length, mutualFunds: fundsNow.length, ppfAccounts: parsed.ppfAccounts.length },
  };
}
