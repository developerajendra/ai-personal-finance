import "server-only";
import * as XLSX from "xlsx";
import type { BankBalance, Investment } from "@/shared/types";
import { getCurrentInvestmentValue } from "@/shared/utils/investmentValue";
import { isSettledReceivable } from "@/shared/utils/receivables";
import { RETIREMENT_INVESTMENT_TYPES } from "@/shared/schemas/finance";
import { loadPortfolio, loadStocks, loadMutualFunds } from "@/server/finance/portfolio/service";
import { loadPPFAccounts } from "@/server/finance/provident-fund/ppfStorage";
import { WORKBOOK_SHEETS } from "@/server/imports/workbookImport";
import * as categoryRepo from "@/server/db/repositories/portfolioCategoryRepository";
import * as loanSnapshotRepo from "@/server/db/repositories/loanSnapshotRepository";
import * as financialSnapshotRepo from "@/server/db/repositories/financialSnapshotRepository";
import * as budgetRepo from "@/server/db/repositories/budgetRepository";
import * as subscriptionRepo from "@/server/db/repositories/subscriptionRepository";

/** Export-only sheets: the importer ignores them, so the workbook still round-trips. */
const EXTRA_SHEETS = {
  summary: "Summary",
  categories: "Categories",
  loanHistory: "Loan EMI History",
  budget: "Budget",
  budgetEntries: "Budget Entries",
  subscriptions: "Subscriptions",
  netWorth: "Net Worth History",
} as const;

const INVESTMENT_TYPE_LABELS: Record<Investment["type"], string> = {
  ppf: "PPF",
  epf: "EPF",
  nps: "NPS",
  "retirement-other": "Retirement (other)",
  fd: "Fixed deposits",
  "mutual-fund": "Mutual funds (manual)",
  stocks: "Stocks (manual)",
  bonds: "Bonds",
  other: "Other",
};

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

const yesNo = (v: boolean | undefined) => (v === false ? "No" : "Yes");
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

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
 * Build the full export workbook: every portfolio record (drafts included), the
 * user's categories, loan EMI history, budget, subscriptions and net-worth history.
 * The portfolio sheets use the importer's format, so export → import round-trips.
 * Summary totals follow the dashboard: published, open records only.
 */
export async function buildPortfolioWorkbook(userId: string): Promise<Buffer> {
  const [
    { investments, loans, properties, bankBalances, transactions },
    stocks,
    funds,
    pf,
    categories,
    loanSnapshots,
    netWorthSnapshots,
    budgetItems,
    budgetEntries,
    subscriptions,
  ] = await Promise.all([
    loadPortfolio(userId),
    loadStocks(userId),
    loadMutualFunds(userId),
    loadPPFAccounts(userId),
    categoryRepo.findByUserId(userId),
    loanSnapshotRepo.findByUserId(userId),
    financialSnapshotRepo.findByUserId(userId),
    budgetRepo.findItems(userId),
    budgetRepo.findAllEntries(userId),
    subscriptionRepo.findByUserId(userId),
  ]);
  const isRecv = (b: BankBalance) => !!b.tags?.includes("receivable");
  const cash = bankBalances.filter((b) => !isRecv(b));
  const recv = bankBalances.filter(isRecv);

  // ── Dashboard-equivalent totals (published, not closed / settled) ──
  const liveInv = investments.filter((i) => i.isPublished && i.status !== "closed");
  const isRetirement = (i: Investment) => (RETIREMENT_INVESTMENT_TYPES as readonly string[]).includes(i.type);
  const isMarket = (i: Investment) => i.type === "stocks" || i.type === "mutual-fund";
  const invValue = (xs: Investment[]) => sum(xs.map(getCurrentInvestmentValue));
  const liveCash = cash.filter((b) => b.isPublished && b.status !== "closed");
  const liveRecv = recv.filter((b) => b.isPublished && !isSettledReceivable(b));
  const liveProps = properties.filter((p) => p.isPublished);
  const liveLoans = loans.filter((l) => l.isPublished && l.status === "active");
  const stocksVal = sum(stocks.map((s) => s.last_price * s.quantity));
  const fundsVal = sum(funds.map((f) => f.last_price * f.quantity));
  const pfVal = sum(pf.map((p) => p.grandTotal || 0));

  const classes: [string, number, number][] = [
    ["Cash & bank", sum(liveCash.map((b) => b.balance || 0)), liveCash.length],
    ["Stocks & funds", stocksVal + fundsVal + invValue(liveInv.filter(isMarket)), stocks.length + funds.length + liveInv.filter(isMarket).length],
    ["Retirement", pfVal + invValue(liveInv.filter(isRetirement)), pf.length + liveInv.filter(isRetirement).length],
    ["Properties", sum(liveProps.map((p) => p.currentValue || p.purchasePrice || 0)), liveProps.length],
    ["Receivables", sum(liveRecv.map(receivableTotal)), liveRecv.length],
    ["Fixed deposits", invValue(liveInv.filter((i) => i.type === "fd")), liveInv.filter((i) => i.type === "fd").length],
    [
      "Other investments",
      invValue(liveInv.filter((i) => i.type !== "fd" && !isMarket(i) && !isRetirement(i))),
      liveInv.filter((i) => i.type !== "fd" && !isMarket(i) && !isRetirement(i)).length,
    ],
  ];
  const assets = sum(classes.map(([, v]) => v));
  const debt = sum(liveLoans.map((l) => l.outstandingAmount));
  const pct = (v: number) => (assets > 0 ? Math.round((v / assets) * 1000) / 10 : 0);

  const byInvType = Object.entries(INVESTMENT_TYPE_LABELS)
    .map(([type, label]) => {
      const xs = liveInv.filter((i) => i.type === type);
      return [label, invValue(xs), xs.length] as const;
    })
    .filter(([, , n]) => n > 0);
  const loanTypes = [...new Set(liveLoans.map((l) => l.type))];
  const drafts = [...investments, ...loans, ...properties, ...bankBalances].filter((r) => !r.isPublished).length;

  const summaryRows: unknown[][] = [
    ["Asset classes", "", "", ""],
    ...classes.map(([label, v, n]) => [label, v, n, pct(v)]),
    ["Total assets", assets, "", 100],
    ["", "", "", ""],
    ["Investments by type", "", "", ""],
    ...byInvType.map(([label, v, n]) => [label, v, n, pct(v)]),
    ["", "", "", ""],
    ["Loans by type (outstanding)", "", "", ""],
    ...loanTypes.map((t) => {
      const xs = liveLoans.filter((l) => l.type === t);
      return [t, sum(xs.map((l) => l.outstandingAmount)), xs.length, ""];
    }),
    ["Total loans", debt, liveLoans.length, ""],
    ["", "", "", ""],
    ["Net worth", assets - debt, "", ""],
    ["", "", "", ""],
    ["Draft records (not in totals)", "", drafts, ""],
    ["Exported", new Date().toISOString(), "", ""],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(["Category", "Amount (₹)", "Records", "Share of Assets (%)"], summaryRows), EXTRA_SHEETS.summary);

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Name", "Slug", "Type", "Icon", "Link", "Description", "Created"],
      categories.map((c) => [c.name, c.slug, c.type, c.icon ?? "", c.href, c.description ?? "", xlDate(c.createdAt)]),
      [6],
    ),
    EXTRA_SHEETS.categories,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Name", "Type", "Asset Type", "Amount (₹)", "Current Value (₹)", "Currency", "Interest Rate (%)", "Compounding (Months)", "Status", "Published", "Start Date", "Maturity Date", "Maturity Amount (₹)", "Rule", "Description", "Tags"],
      investments.map((i) => [
        i.name,
        i.type,
        i.assetType ?? "",
        i.amount,
        getCurrentInvestmentValue(i),
        i.originalCurrency || i.currency || "INR",
        i.interestRate ?? "",
        i.compoundingMonths ?? "",
        i.status,
        yesNo(i.isPublished),
        xlDate(i.startDate),
        xlDate(i.maturityDate),
        i.maturityAmount ?? 0,
        i.ruleLabel ?? "",
        i.description ?? "",
        (i.tags ?? []).join(", "),
      ]),
      [10, 11],
    ),
    WORKBOOK_SHEETS.investments,
  );

  const bankRow = (b: BankBalance) => [
    b.bankName,
    b.accountNumber ?? "",
    b.accountType,
    b.balance,
    isRecv(b) ? receivableTotal(b) : b.balance,
    b.originalCurrency || b.currency || "INR",
    b.interestRate ?? "",
    b.status,
    yesNo(b.isPublished),
    xlDate(b.lastUpdated),
    xlDate(b.issueDate),
    xlDate(b.dueDate),
    xlDate(b.paidDate),
    b.description ?? "",
    (b.tags ?? []).join(", "),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Bank Name", "Account Number", "Account Type", "Balance (₹)", "Expected Value (₹)", "Currency", "Interest Rate (%)", "Status", "Published", "Last Updated", "Issue Date", "Due Date", "Paid Date", "Description", "Tags"],
      [...cash.map(bankRow), ...(recv.length ? [["─── Receivables ───"], ...recv.map(bankRow)] : [])],
      [9, 10, 11, 12],
    ),
    WORKBOOK_SHEETS.bank,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Name", "Type", "Principal (₹)", "Outstanding (₹)", "Repaid (₹)", "EMI Amount (₹)", "EMI Date", "Interest Rate (%)", "Tenure (Months)", "Status", "Published", "Start Date", "End Date", "Description"],
      loans.map((l) => [
        l.name,
        l.type,
        l.principalAmount,
        l.outstandingAmount,
        Math.max(0, l.principalAmount - l.outstandingAmount),
        l.emiAmount,
        l.emiDate,
        l.interestRate,
        l.tenureMonths,
        l.status,
        yesNo(l.isPublished),
        xlDate(l.startDate),
        xlDate(l.endDate),
        l.description ?? "",
      ]),
      [11, 12],
    ),
    WORKBOOK_SHEETS.loans,
  );

  const loanName = new Map(loans.map((l) => [l.id, l.name]));
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Loan", "Year", "Month", "Outstanding (₹)", "Principal Paid (₹)", "Interest Paid (₹)", "EMI Amount (₹)", "Interest Rate (%)", "Remaining Tenure (Months)", "Snapshot Date"],
      [...loanSnapshots]
        .sort((a, b) => (loanName.get(a.loanId) ?? a.loanId).localeCompare(loanName.get(b.loanId) ?? b.loanId) || a.year - b.year || a.month - b.month)
        .map((s) => [loanName.get(s.loanId) ?? s.loanId, s.year, s.month, s.outstandingAmount, s.principalPaid, s.interestPaid, s.emiAmount, s.interestRate, s.remainingTenureMonths, xlDate(s.snapshotDate)]),
      [9],
    ),
    EXTRA_SHEETS.loanHistory,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Name", "Type", "Asset Type", "Purchase Price (₹)", "Current Value (₹)", "Purchase Date", "Location", "Status", "Published", "Description"],
      properties.map((p) => [p.name, p.type, p.assetType ?? "", p.purchasePrice, p.currentValue ?? "", xlDate(p.purchaseDate), p.location, p.status, yesNo(p.isPublished), p.description ?? ""]),
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

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Name", "Kind", "Category", "Cost Type", "Frequency", "Planned Amount (₹)", "Due Day", "Due Month", "Paid From", "Loan", "Active", "Notes"],
      budgetItems.map((b) => [b.name, b.kind, b.category, b.costType, b.frequency, b.amount, b.dueDay ?? "", b.dueMonth ?? "", b.paidFrom ?? "", b.loanId ? (loanName.get(b.loanId) ?? "") : "", yesNo(b.active), b.notes ?? ""]),
    ),
    EXTRA_SHEETS.budget,
  );

  const budgetName = new Map(budgetItems.map((b) => [b.id, b.name]));
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Date", "Month", "Budget Item", "Amount (₹)", "Note"],
      budgetEntries.map((e) => [xlDate(e.date), e.month, budgetName.get(e.itemId) ?? "", e.amount, e.note ?? ""]),
      [0],
    ),
    EXTRA_SHEETS.budgetEntries,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Name", "Plan", "Category", "Amount", "Currency", "Cycle", "Next Date", "Ends", "Status", "Paid With", "Remind", "Notes"],
      subscriptions.map((s) => [s.name, s.plan ?? "", s.category, s.amount, s.currency, s.cycle, xlDate(s.nextDate), s.ends ? "Yes" : "No", s.status, s.paidWith ?? "", yesNo(s.remind), s.notes ?? ""]),
      [6],
    ),
    EXTRA_SHEETS.subscriptions,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      ["Period", "Year", "Month", "Snapshot Date", "Net Worth (₹)", "Investments (₹)", "Bank Balances (₹)", "Receivables (₹)", "Properties (₹)", "Stocks (₹)", "Mutual Funds (₹)", "PPF (₹)", "Loans (₹)", "Fixed Assets (₹)", "Liquid Assets (₹)", "Income (₹)", "Expenses (₹)"],
      [...netWorthSnapshots]
        .sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0))
        .map((s) => [s.period, s.year, s.month ?? "", xlDate(s.snapshotDate), s.netWorth, s.totalInvestments, s.totalBankBalances, s.totalReceivables, s.totalProperties, s.totalStocks, s.totalMutualFunds, s.totalPPF, s.totalLoans, s.totalFixedAssets, s.totalLiquidAssets, s.totalIncome, s.totalExpenses]),
      [3],
    ),
    EXTRA_SHEETS.netWorth,
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
