import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/core/auth/getSession";
import * as transactionRepo from "@/core/db/repositories/transactionRepository";
import { EXPENSE_GROUPS } from "@/core/config/constants";
import { Transaction } from "@/core/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatLabel(slug: string) {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}


const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const INR_FMT  = '₹#,##,##0.00';
const DATE_FMT = 'dd-mmm-yyyy';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const frequency = searchParams.get("frequency") ?? "";
    const group     = searchParams.get("group") ?? "";

    // Fetch all debit transactions
    const all: Transaction[] = await transactionRepo.findByUserId(session.userId);

    let expenses = all.filter((tx) => tx.type === "debit");

    // Filter by frequency if specified
    if (frequency && ["daily", "monthly", "yearly"].includes(frequency)) {
      expenses = expenses.filter((tx) => tx.frequency === frequency);
    }

    if (group && EXPENSE_GROUPS[group]) {
      expenses = expenses.filter((tx) => EXPENSE_GROUPS[group].includes(tx.category));
    }

    // Build Excel
    const wb = new ExcelJS.Workbook();
    wb.creator = "Personal Finance AI";
    wb.created = new Date();

    // ── Sheet 1: Expenses ──
    const ws = wb.addWorksheet("Expenses");
    const headers = ["Date", "Description", "Category", "Group", "Frequency", "Amount (₹)"];
    const widths  = [16,     40,             22,         22,      14,          16];
    ws.columns = headers.map((h, i) => ({ header: h, key: h, width: widths[i] }));

    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    headerRow.height = 22;

    // Find group for a category
    function categoryGroup(cat: string): string {
      for (const [g, slugs] of Object.entries(EXPENSE_GROUPS)) {
        if (slugs.includes(cat)) return g;
      }
      return "Other";
    }

    expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    expenses.forEach((tx, i) => {
      const row = ws.getRow(i + 2);
      // Date
      const dateCell = row.getCell(1);
      const d = new Date(tx.date);
      dateCell.value = isNaN(d.getTime()) ? tx.date : d;
      dateCell.numFmt = DATE_FMT;
      // Description
      row.getCell(2).value = tx.description;
      // Category
      row.getCell(3).value = formatLabel(tx.category);
      // Group
      row.getCell(4).value = categoryGroup(tx.category);
      // Frequency
      row.getCell(5).value = tx.frequency ? formatLabel(tx.frequency) : "One-time";
      // Amount
      const amtCell = row.getCell(6);
      amtCell.value = tx.amount;
      amtCell.numFmt = INR_FMT;

      // Alternating row bg
      if (i % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F7FF" } };
        });
      }
    });

    // Auto-filter
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

    // ── Sheet 2: Summary by Group ──
    const ws2 = wb.addWorksheet("By Group");
    ws2.columns = [
      { header: "Group",       key: "group",  width: 26 },
      { header: "Count",       key: "count",  width: 10 },
      { header: "Total (₹)",   key: "total",  width: 18 },
    ];
    const h2 = ws2.getRow(1);
    h2.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    h2.height = 22;

    const groupSummary = Object.entries(EXPENSE_GROUPS).map(([g, slugs]) => {
      const txs = expenses.filter((tx) => slugs.includes(tx.category));
      return { group: g, count: txs.length, total: txs.reduce((s, tx) => s + tx.amount, 0) };
    });

    groupSummary.forEach((row, i) => {
      const r = ws2.getRow(i + 2);
      r.getCell(1).value = row.group;
      r.getCell(2).value = row.count;
      const c = r.getCell(3);
      c.value = row.total;
      c.numFmt = INR_FMT;
    });

    // Grand total row
    const totalRow = ws2.getRow(groupSummary.length + 2);
    totalRow.getCell(1).value = "TOTAL";
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(2).value = expenses.length;
    totalRow.getCell(2).font = { bold: true };
    const totalCell = totalRow.getCell(3);
    totalCell.value = expenses.reduce((s, tx) => s + tx.amount, 0);
    totalCell.numFmt = INR_FMT;
    totalCell.font = { bold: true };

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="expenses${frequency ? `-${frequency}` : ""}${group ? `-${group.replace(/\s+/g, "-").toLowerCase()}` : ""}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
