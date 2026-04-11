import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireSession } from "@/core/auth/getSession";
import * as investmentRepo from "@/core/db/repositories/investmentRepository";
import * as bankBalanceRepo from "@/core/db/repositories/bankBalanceRepository";
import * as loanRepo from "@/core/db/repositories/loanRepository";
import * as propertyRepo from "@/core/db/repositories/propertyRepository";
import * as stockRepo from "@/core/db/repositories/stockRepository";
import * as mutualFundRepo from "@/core/db/repositories/mutualFundRepository";
import * as ppfAccountRepo from "@/core/db/repositories/ppfAccountRepository";
import * as transactionRepo from "@/core/db/repositories/transactionRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Colour palette ────────────────────────────────────────────────────────────
type SheetKey = "summary" | "investments" | "bank" | "loans" | "properties" | "stocks" | "mutualFunds" | "ppf" | "transactions";
const HEADER_FILLS: Record<SheetKey, ExcelJS.Fill> = {
  summary:      { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } },
  investments:  { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } },
  bank:         { type: "pattern", pattern: "solid", fgColor: { argb: "FF283593" } },
  loans:        { type: "pattern", pattern: "solid", fgColor: { argb: "FFC62828" } },
  properties:   { type: "pattern", pattern: "solid", fgColor: { argb: "FFE65100" } },
  stocks:       { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E7D32" } },
  mutualFunds:  { type: "pattern", pattern: "solid", fgColor: { argb: "FF6A1B9A" } },
  ppf:          { type: "pattern", pattern: "solid", fgColor: { argb: "FF00695C" } },
  transactions: { type: "pattern", pattern: "solid", fgColor: { argb: "FF37474F" } },
};

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

const INR_FMT  = '₹#,##,##0.00';
const PCT_FMT  = '0.00"%"';
const DATE_FMT = 'dd-mmm-yyyy';

// ── Helpers ───────────────────────────────────────────────────────────────────
function applyHeaders(sheet: ExcelJS.Worksheet, headers: string[], widths: number[], fill: ExcelJS.Fill) {
  sheet.columns = headers.map((h, i) => ({ header: h, key: h, width: widths[i] ?? 18 }));
  const row = sheet.getRow(1);
  row.eachCell((cell) => {
    cell.fill = fill;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  row.height = 22;
}

function setInr(sheet: ExcelJS.Worksheet, r: number, c: number, v: number | null | undefined) {
  const cell = sheet.getCell(r, c);
  cell.value = v ?? 0;
  cell.numFmt = INR_FMT;
}

function setDate(sheet: ExcelJS.Worksheet, r: number, c: number, v: string | null | undefined) {
  const cell = sheet.getCell(r, c);
  if (v) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) { cell.value = d; cell.numFmt = DATE_FMT; return; }
  }
  cell.value = v ?? "";
}

function greenRedFill(positive: boolean): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: positive ? "FFE8F5E9" : "FFFFEBEE" } };
}

// ── Sheet builders ────────────────────────────────────────────────────────────

function buildSummary(wb: ExcelJS.Workbook, data: {
  investments: any[]; bankBalances: any[]; loans: any[];
  properties: any[]; stocks: any[]; mutualFunds: any[]; ppfAccounts: any[];
}) {
  const sheet = wb.addWorksheet("Summary");
  sheet.columns = [{ key: "label", width: 34 }, { key: "value", width: 22 }];

  const activeInv     = data.investments.filter(i => i.status !== "closed");
  const bankOnly      = data.bankBalances.filter(b => !b.tags?.includes("receivable"));
  const receivables   = data.bankBalances.filter(b =>  b.tags?.includes("receivable"));

  const totals = {
    investments:  activeInv.reduce((s, i) => s + (i.amount ?? 0), 0),
    bank:         bankOnly.reduce((s, b) => s + (b.balance ?? 0), 0),
    receivables:  receivables.reduce((s, r) => s + (r.balance ?? 0), 0),
    loans:        data.loans.reduce((s, l) => s + (l.outstandingAmount ?? 0), 0),
    properties:   data.properties.reduce((s, p) => s + (p.currentValue ?? p.purchasePrice ?? 0), 0),
    stocks:       data.stocks.reduce((s, st) => s + ((st.last_price ?? 0) * (st.quantity ?? 0)), 0),
    mutualFunds:  data.mutualFunds.reduce((s, mf) => s + ((mf.last_price ?? 0) * (mf.quantity ?? 0)), 0),
    ppf:          data.ppfAccounts.reduce((s, p) => s + (p.grandTotal ?? 0), 0),
  };
  const totalAssets = totals.investments + totals.bank + totals.receivables + totals.properties + totals.stocks + totals.mutualFunds + totals.ppf;
  const netWorth    = totalAssets - totals.loans;

  // Header row
  const hdr = sheet.addRow(["Category", "Amount (₹)"]);
  ["A1","B1"].forEach(addr => {
    const c = sheet.getCell(addr);
    c.fill = HEADER_FILLS.summary; c.font = HEADER_FONT;
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  hdr.height = 22;

  const rows: [string, number | string, boolean?][] = [
    ["Investments (Active)",         totals.investments],
    ["Bank Balances",                totals.bank],
    ["Receivables",                  totals.receivables],
    ["Properties",                   totals.properties],
    ["Stocks (Zerodha)",             totals.stocks],
    ["Mutual Funds (Zerodha)",       totals.mutualFunds],
    ["Provident Fund (PPF)",         totals.ppf],
    ["─────────────────",            "─────────────"],
    ["Total Assets",                 totalAssets, true],
    ["Total Loans (Outstanding)",    totals.loans],
    ["Net Worth",                    netWorth, true],
    ["Export Date",                  new Date().toLocaleDateString("en-IN")],
  ];

  rows.forEach(([label, value, bold]) => {
    const row = sheet.addRow([label, ""]);
    const labelCell = row.getCell(1);
    const valCell   = row.getCell(2);
    if (bold) { labelCell.font = { bold: true, size: 11 }; valCell.font = { bold: true, size: 11 }; }
    if (label === "Net Worth") {
      const fill = greenRedFill(netWorth >= 0);
      labelCell.fill = fill; valCell.fill = fill;
    }
    if (typeof value === "number") { valCell.value = value; valCell.numFmt = INR_FMT; }
    else { valCell.value = value; }
  });
}

function buildInvestments(wb: ExcelJS.Workbook, investments: any[]) {
  const sheet = wb.addWorksheet("Investments");
  applyHeaders(sheet,
    ["Name","Type","Asset Type","Amount (₹)","Currency","Interest Rate (%)","Status","Start Date","Maturity Date","Maturity Amount (₹)","Rule","Description","Tags"],
    [28, 14, 12, 18, 10, 20, 10, 14, 14, 22, 20, 26, 20],
    HEADER_FILLS.investments
  );
  investments.forEach((inv, idx) => {
    const r = idx + 2;
    sheet.getRow(r).values = [inv.name, inv.type, inv.assetType ?? "", "", inv.currency ?? "INR", inv.interestRate ?? "", inv.status, "", "", "", inv.ruleLabel ?? "", inv.description ?? "", Array.isArray(inv.tags) ? inv.tags.join(", ") : ""];
    setInr(sheet, r, 4, inv.amount);
    if (inv.interestRate != null) sheet.getCell(r, 6).numFmt = PCT_FMT;
    setDate(sheet, r, 8, inv.startDate);
    setDate(sheet, r, 9, inv.maturityDate);
    setInr(sheet, r, 10, inv.maturityAmount);
  });
}

function buildBankBalances(wb: ExcelJS.Workbook, bankBalances: any[]) {
  const sheet = wb.addWorksheet("Bank Balances & Receivables");
  applyHeaders(sheet,
    ["Bank Name","Account Number","Account Type","Balance (₹)","Currency","Interest Rate (%)","Status","Last Updated","Issue Date","Due Date","Description","Tags"],
    [22, 18, 14, 18, 10, 20, 10, 14, 14, 14, 26, 20],
    HEADER_FILLS.bank
  );
  const bankOnly    = bankBalances.filter(b => !b.tags?.includes("receivable"));
  const receivables = bankBalances.filter(b =>  b.tags?.includes("receivable"));

  [...bankOnly, ...receivables].forEach((bb, idx) => {
    const r = idx + 2;
    const isRec = bb.tags?.includes("receivable");
    sheet.getRow(r).values = [bb.bankName, bb.accountNumber ?? "", bb.accountType, "", bb.currency ?? "INR", bb.interestRate ?? "", bb.status, "", "", "", bb.description ?? "", Array.isArray(bb.tags) ? bb.tags.join(", ") : ""];
    setInr(sheet, r, 4, bb.balance);
    if (bb.interestRate != null) sheet.getCell(r, 6).numFmt = PCT_FMT;
    setDate(sheet, r, 8, bb.lastUpdated);
    setDate(sheet, r, 9, bb.issueDate);
    setDate(sheet, r, 10, bb.dueDate);
    if (isRec) {
      const fill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFDE7" } };
      sheet.getRow(r).eachCell(c => { c.fill = fill; });
    }
  });

  // Separator between bank and receivables sections
  if (bankOnly.length > 0 && receivables.length > 0) {
    const sepIdx = bankOnly.length + 2;
    sheet.spliceRows(sepIdx, 0, ["─── Receivables ───"]);
    const sep = sheet.getRow(sepIdx);
    sep.getCell(1).font = { bold: true, italic: true };
    sep.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9C4" } };
  }
}

function buildLoans(wb: ExcelJS.Workbook, loans: any[]) {
  const sheet = wb.addWorksheet("Loans");
  applyHeaders(sheet,
    ["Name","Type","Principal (₹)","Outstanding (₹)","EMI Amount (₹)","EMI Date","Interest Rate (%)","Tenure (Months)","Status","Start Date","End Date","Description"],
    [26, 16, 18, 18, 18, 10, 20, 16, 10, 14, 14, 26],
    HEADER_FILLS.loans
  );
  loans.forEach((loan, idx) => {
    const r = idx + 2;
    sheet.getRow(r).values = [loan.name, loan.type, "", "", "", loan.emiDate ?? "", loan.interestRate ?? "", loan.tenureMonths ?? "", loan.status, "", "", loan.description ?? ""];
    setInr(sheet, r, 3, loan.principalAmount);
    setInr(sheet, r, 4, loan.outstandingAmount);
    setInr(sheet, r, 5, loan.emiAmount);
    if (loan.interestRate != null) sheet.getCell(r, 7).numFmt = PCT_FMT;
    setDate(sheet, r, 10, loan.startDate);
    setDate(sheet, r, 11, loan.endDate);
  });
}

function buildProperties(wb: ExcelJS.Workbook, properties: any[]) {
  const sheet = wb.addWorksheet("Properties");
  applyHeaders(sheet,
    ["Name","Type","Asset Type","Purchase Price (₹)","Current Value (₹)","Purchase Date","Location","Status","Description"],
    [26, 14, 12, 22, 22, 14, 24, 12, 30],
    HEADER_FILLS.properties
  );
  properties.forEach((prop, idx) => {
    const r = idx + 2;
    sheet.getRow(r).values = [prop.name, prop.type, prop.assetType ?? "", "", "", "", prop.location ?? "", prop.status, prop.description ?? ""];
    setInr(sheet, r, 4, prop.purchasePrice);
    setInr(sheet, r, 5, prop.currentValue ?? prop.purchasePrice);
    setDate(sheet, r, 6, prop.purchaseDate);
  });
}

function buildStocks(wb: ExcelJS.Workbook, stocks: any[]) {
  const sheet = wb.addWorksheet("Stocks");
  applyHeaders(sheet,
    ["Symbol","Exchange","Quantity","Avg Price (₹)","Last Price (₹)","Current Value (₹)","P&L (₹)","P&L (%)"],
    [16, 10, 10, 16, 16, 20, 16, 12],
    HEADER_FILLS.stocks
  );
  stocks.forEach((s, idx) => {
    const r = idx + 2;
    const val = (s.last_price ?? 0) * (s.quantity ?? 0);
    sheet.getRow(r).values = [s.tradingsymbol, s.exchange, s.quantity ?? 0, "", "", "", "", ""];
    setInr(sheet, r, 4, s.average_price);
    setInr(sheet, r, 5, s.last_price);
    setInr(sheet, r, 6, val);
    setInr(sheet, r, 7, s.pnl);
    const pctCell = sheet.getCell(r, 8);
    pctCell.value = s.pnl_percentage ?? 0; pctCell.numFmt = PCT_FMT;
    const fill = greenRedFill((s.pnl ?? 0) >= 0);
    sheet.getCell(r, 7).fill = fill; pctCell.fill = fill;
  });
}

function buildMutualFunds(wb: ExcelJS.Workbook, mutualFunds: any[]) {
  const sheet = wb.addWorksheet("Mutual Funds");
  applyHeaders(sheet,
    ["Symbol","Fund Name","Folio","Quantity","Avg Price (₹)","Last Price (₹)","Current Value (₹)","P&L (₹)","P&L (%)"],
    [16, 36, 14, 10, 16, 16, 20, 16, 12],
    HEADER_FILLS.mutualFunds
  );
  mutualFunds.forEach((mf, idx) => {
    const r = idx + 2;
    const val = (mf.last_price ?? 0) * (mf.quantity ?? 0);
    sheet.getRow(r).values = [mf.tradingsymbol, mf.fund_name, mf.folio ?? "", mf.quantity ?? 0, "", "", "", "", ""];
    setInr(sheet, r, 5, mf.average_price);
    setInr(sheet, r, 6, mf.last_price);
    setInr(sheet, r, 7, val);
    setInr(sheet, r, 8, mf.pnl);
    const pctCell = sheet.getCell(r, 9);
    pctCell.value = mf.pnl_percentage ?? 0; pctCell.numFmt = PCT_FMT;
    const fill = greenRedFill((mf.pnl ?? 0) >= 0);
    sheet.getCell(r, 8).fill = fill; pctCell.fill = fill;
  });
}

function buildPPF(wb: ExcelJS.Workbook, ppfAccounts: any[]) {
  const sheet = wb.addWorksheet("Provident Fund");
  applyHeaders(sheet,
    ["Member ID","Member Name","Establishment ID","Establishment Name","Employee Share (₹)","Employer Share (₹)","Grand Total (₹)","Last Updated"],
    [14, 20, 18, 28, 22, 22, 18, 14],
    HEADER_FILLS.ppf
  );
  ppfAccounts.forEach((ppf, idx) => {
    const r = idx + 2;
    sheet.getRow(r).values = [ppf.memberId ?? "", ppf.memberName ?? "", ppf.establishmentId ?? "", ppf.establishmentName ?? "", "", "", "", ""];
    setInr(sheet, r, 5, ppf.depositEmployeeShare);
    setInr(sheet, r, 6, ppf.depositEmployerShare);
    setInr(sheet, r, 7, ppf.grandTotal);
    setDate(sheet, r, 8, ppf.lastUpdated ?? ppf.extractedAt);
  });
}

function buildTransactions(wb: ExcelJS.Workbook, transactions: any[]) {
  const sheet = wb.addWorksheet("Transactions");
  applyHeaders(sheet,
    ["Date","Description","Category","Type","Amount (₹)","Balance (₹)","Account","Source"],
    [14, 36, 18, 10, 16, 16, 18, 14],
    HEADER_FILLS.transactions
  );
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  sorted.forEach((tx, idx) => {
    const r = idx + 2;
    sheet.getRow(r).values = ["", tx.description, tx.category, tx.type, "", "", tx.account ?? "", tx.source];
    setDate(sheet, r, 1, tx.date);
    setInr(sheet, r, 5, tx.amount);
    setInr(sheet, r, 6, tx.balance);
    const fill = greenRedFill(tx.type === "credit");
    sheet.getCell(r, 4).fill = fill;
    sheet.getCell(r, 5).fill = fill;
  });
}

// ── Route Handler ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const session = await requireSession();
    const userId  = session.userId;

    const [investments, bankBalances, loans, properties, stocks, mutualFunds, ppfAccounts, transactions] =
      await Promise.all([
        investmentRepo.findByUserId(userId),
        bankBalanceRepo.findByUserId(userId),
        loanRepo.findByUserId(userId),
        propertyRepo.findByUserId(userId),
        stockRepo.findByUserId(userId),
        mutualFundRepo.findByUserId(userId),
        ppfAccountRepo.findByUserId(userId),
        transactionRepo.findByUserId(userId),
      ]);

    const wb = new ExcelJS.Workbook();
    wb.creator  = session.name ?? session.email;
    wb.created  = new Date();
    wb.modified = new Date();

    buildSummary(wb,     { investments, bankBalances, loans, properties, stocks, mutualFunds, ppfAccounts });
    buildInvestments(wb, investments);
    buildBankBalances(wb, bankBalances);
    buildLoans(wb,       loans);
    buildProperties(wb,  properties);
    buildStocks(wb,      stocks);
    buildMutualFunds(wb, mutualFunds);
    buildPPF(wb,         ppfAccounts);
    buildTransactions(wb, transactions);

    const buffer = await wb.xlsx.writeBuffer();
    const today  = new Date().toISOString().split("T")[0];

    return new Response(new Uint8Array(buffer as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="portfolio-export-${today}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[export/portfolio]", err);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}
