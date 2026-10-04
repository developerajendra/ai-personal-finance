import "server-only";
import * as XLSX from "xlsx";
import type { BankBalance } from "@/shared/types";
import { getCurrentInvestmentValue } from "@/shared/utils/investmentValue";
import { loadPortfolio, loadStocks, loadMutualFunds } from "@/server/finance/portfolio/service";
import { loadPPFAccounts } from "@/server/finance/provident-fund/ppfStorage";
import { WORKBOOK_SHEETS } from "@/server/imports/workbookImport";

/** Excel serial date from an ISO string, so dates stay real dates in Excel. */
function xlDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.getTime() / 864e5 + 25569;
}

function receivableTotal(bb: BankBalance) {
  const principal = bb.balance || 0;
  if (!bb.interestRate || !bb.issueDate) return principal;
  const days = Math.max(0, (new Date(bb.dueDate || Date.now()).getTime() - new Date(bb.issueDate).getTime()) / 864e5);
  return principal + principal * (bb.interestRate / 100) * (days / 365);
}

function sheet(header: string[], rows: unknown[][], dateCols: number[] = []) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = header.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  // Format serial dates as dates
  for (let r = 1; r <= rows.length; r++) {
    for (const c of dateCols) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "number") cell.z = "yyyy-mm-dd";
    }
  }
  return ws;
}

/**
 * Build the portfolio workbook (all records, drafts included). The same
 * format is accepted by the importer, so export → import round-trips.
 */
export async function buildPortfolioWorkbook(userId: string): Promise<Buffer> {
  const [{ investments, loans, properties, bankBalances, transactions }, stocks, funds, pf] = await Promise.all([
    loadPortfolio(userId),
    loadStocks(userId),
    loadMutualFunds(userId),
    loadPPFAccounts(userId),
  ]);
  const cash = bankBalances.filter((b) => !b.tags?.includes("receivable"));
  const recv = bankBalances.filter((b) => b.tags?.includes("receivable"));
  const active = investments.filter((i) => i.status !== "closed");

  const wb = XLSX.utils.book_new();
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const summary: [string, number][] = [
    ["Investments (Active)", sum(active.map(getCurrentInvestmentValue))],
    ["Bank Balances", sum(cash.map((b) => b.balance || 0))],
    ["Receivables", sum(recv.map(receivableTotal))],
    ["Properties", sum(properties.map((p) => p.currentValue || p.purchasePrice || 0))],
    ["Stocks (Zerodha)", sum(stocks.map((s) => s.last_price * s.quantity))],
    ["Mutual Funds (Zerodha)", sum(funds.map((f) => f.last_price * f.quantity))],
    ["Provident Fund (PPF)", sum(pf.map((p) => p.grandTotal || 0))],
  ];
  const assets = sum(summary.map(([, v]) => v));
  const debt = sum(loans.filter((l) => l.status === "active").map((l) => l.outstandingAmount));
  XLSX.utils.book_append_sheet(
    wb,
    sheet(["Category", "Amount (₹)"], [...summary, ["", ""], ["Total Assets", assets], ["Loans (Outstanding)", debt], ["Net Worth", assets - debt], ["Exported", new Date().toISOString()]]),
    "Summary",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Name", "Type", "Asset Type", "Amount (₹)", "Currency", "Interest Rate (%)", "Status", "Start Date", "Maturity Date", "Maturity Amount (₹)", "Rule", "Description", "Tags"],
      investments.map((i) => [i.name, i.type, i.assetType ?? "", i.amount, i.originalCurrency || i.currency || "INR", i.interestRate ?? "", i.status, xlDate(i.startDate), xlDate(i.maturityDate), i.maturityAmount ?? 0, i.ruleLabel ?? "", i.description ?? "", (i.tags ?? []).join(", ")]),
      [7, 8],
    ),
    WORKBOOK_SHEETS.investments,
  );

  const bankRow = (b: BankBalance) => [b.bankName, b.accountNumber ?? "", b.accountType, b.balance, b.originalCurrency || b.currency || "INR", b.interestRate ?? "", b.status, xlDate(b.lastUpdated), xlDate(b.issueDate), xlDate(b.dueDate), b.description ?? "", (b.tags ?? []).join(", ")];
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Bank Name", "Account Number", "Account Type", "Balance (₹)", "Currency", "Interest Rate (%)", "Status", "Last Updated", "Issue Date", "Due Date", "Description", "Tags"],
      [...cash.map(bankRow), ...(recv.length ? [["─── Receivables ───"], ...recv.map(bankRow)] : [])],
      [7, 8, 9],
    ),
    WORKBOOK_SHEETS.bank,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Name", "Type", "Principal (₹)", "Outstanding (₹)", "EMI Amount (₹)", "EMI Date", "Interest Rate (%)", "Tenure (Months)", "Status", "Start Date", "End Date", "Description"],
      loans.map((l) => [l.name, l.type, l.principalAmount, l.outstandingAmount, l.emiAmount, l.emiDate, l.interestRate, l.tenureMonths, l.status, xlDate(l.startDate), xlDate(l.endDate), l.description ?? ""]),
      [9, 10],
    ),
    WORKBOOK_SHEETS.loans,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Name", "Type", "Asset Type", "Purchase Price (₹)", "Current Value (₹)", "Purchase Date", "Location", "Status", "Description"],
      properties.map((p) => [p.name, p.type, p.assetType ?? "", p.purchasePrice, p.currentValue ?? "", xlDate(p.purchaseDate), p.location, p.status, p.description ?? ""]),
      [5],
    ),
    WORKBOOK_SHEETS.properties,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Symbol", "Exchange", "Quantity", "Avg Price (₹)", "Last Price (₹)", "Current Value (₹)", "P&L (₹)", "P&L (%)"],
      stocks.map((s) => [s.tradingsymbol, s.exchange, s.quantity, s.average_price, s.last_price, s.last_price * s.quantity, s.pnl, s.pnl_percentage]),
    ),
    WORKBOOK_SHEETS.stocks,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Symbol", "Fund Name", "Folio", "Quantity", "Avg Price (₹)", "Last Price (₹)", "Current Value (₹)", "P&L (₹)", "P&L (%)"],
      funds.map((f) => [f.tradingsymbol, f.fund_name, f.folio, f.quantity, f.average_price, f.last_price, f.last_price * f.quantity, f.pnl, f.pnl_percentage]),
    ),
    WORKBOOK_SHEETS.funds,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Member ID", "Member Name", "Establishment ID", "Establishment Name", "Employee Share (₹)", "Employer Share (₹)", "Grand Total (₹)", "Last Updated"],
      pf.map((p) => [p.memberId ?? "", p.memberName ?? "", p.establishmentId ?? "", p.establishmentName ?? "", (p.depositEmployeeShare || 0) - (p.withdrawEmployeeShare || 0), (p.depositEmployerShare || 0) - (p.withdrawEmployerShare || 0), p.grandTotal, xlDate(p.lastUpdated || p.extractedAt)]),
      [7],
    ),
    WORKBOOK_SHEETS.pf,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Date", "Description", "Category", "Type", "Amount (₹)", "Balance (₹)", "Account", "Source"],
      transactions.map((t) => [xlDate(t.date), t.description, t.category, t.type, t.amount, t.balance ?? 0, t.account ?? "", t.source]),
      [0],
    ),
    WORKBOOK_SHEETS.transactions,
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
