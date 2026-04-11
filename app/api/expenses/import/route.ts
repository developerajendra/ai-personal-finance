import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/core/auth/getSession";
import { appendToJson, initializeStorage } from "@/core/services/jsonStorageService";
import { Transaction } from "@/core/types";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * Expected Excel columns (case-insensitive):
 *   Date | Description | Category | Amount | Frequency (optional)
 *
 * The import template matches the export format from /api/expenses/export.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "Empty workbook." }, { status: 400 });
    }

    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName],
      { defval: null, raw: false }
    );

    if (!rows.length) {
      return NextResponse.json({ error: "No data rows found in file." }, { status: 400 });
    }

    const transactions: Transaction[] = [];
    const errors: string[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // 1-indexed + header row
      // Normalize keys
      const keys = Object.keys(row).reduce<Record<string, any>>((acc, k) => {
        acc[k.toLowerCase().trim()] = row[k];
        return acc;
      }, {});

      // Date
      const rawDate = keys["date"];
      let dateStr = "";
      if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().split("T")[0];
      } else if (typeof rawDate === "string" && rawDate.trim()) {
        const d = new Date(rawDate.trim());
        dateStr = isNaN(d.getTime()) ? rawDate.trim() : d.toISOString().split("T")[0];
      }
      if (!dateStr) { errors.push(`Row ${rowNum}: missing or invalid date.`); return; }

      // Description
      const desc = String(keys["description"] ?? "").trim();
      if (!desc) { errors.push(`Row ${rowNum}: missing description.`); return; }

      // Category — slug-ify if label was exported
      const rawCat = String(keys["category"] ?? "").trim();
      const category = rawCat.toLowerCase().replace(/\s+/g, "-");
      if (!category) { errors.push(`Row ${rowNum}: missing category.`); return; }

      // Amount
      const rawAmt = keys["amount (₹)"] ?? keys["amount"] ?? keys["amount (rs)"];
      const amount = parseFloat(String(rawAmt ?? "").replace(/[^0-9.]/g, ""));
      if (isNaN(amount) || amount <= 0) { errors.push(`Row ${rowNum}: invalid amount "${rawAmt}".`); return; }

      // Frequency (optional)
      const rawFreq = String(keys["frequency"] ?? "one-time").trim().toLowerCase();
      const freq = (["daily", "monthly", "yearly", "one-time"].includes(rawFreq) ? rawFreq : "one-time") as Transaction["frequency"];

      transactions.push({
        id: randomUUID(),
        date: dateStr,
        description: desc,
        category,
        amount,
        type: "debit",
        frequency: freq,
        source: "excel",
        qualityGrade: "A",
      });
    });

    if (!transactions.length) {
      return NextResponse.json(
        { error: `No valid rows to import. Errors: ${errors.slice(0, 5).join("; ")}` },
        { status: 400 }
      );
    }

    initializeStorage();
    await appendToJson<Transaction>("transactions", transactions, session.userId);

    return NextResponse.json({
      count: transactions.length,
      skipped: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Import failed. Please check your file format." }, { status: 500 });
  }
}
