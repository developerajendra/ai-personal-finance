/**
 * One-time migration script: JSON files → SQLite
 *
 * Usage:
 *   npx tsx scripts/migrate-json-to-sqlite.ts [email]
 *
 * If email is provided, it creates a user with that email.
 * If not, it prompts or uses a default.
 */

import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import * as schema from "../core/db/schema";
import { eq } from "drizzle-orm";

const DB_PATH = path.join(process.cwd(), "data", "app.db");
const DATA_DIR = path.join(process.cwd(), "data");
const PF_DIR = path.join(DATA_DIR, "pfData");
const LOANS_DIR = path.join(DATA_DIR, "loans");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

function readJson<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    console.log(`  Skipping ${path.basename(filePath)}: could not parse`);
    return [];
  }
}

function readJsonObj(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function main() {
  const emailArg = process.argv[2] || "admin@example.com";
  const defaultPassword = "changeme123";

  console.log("=== JSON → SQLite Migration ===\n");

  // 1. Create or find the default user
  const [existingUser] = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, emailArg))
    .limit(1)
    .all();

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    console.log(`Found existing user: ${emailArg} (${userId})`);
  } else {
    userId = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);
    db.insert(schema.users)
      .values({
        id: userId,
        email: emailArg,
        name: "Admin",
        hashedPassword,
      })
      .run();
    console.log(`Created user: ${emailArg} (${userId})`);
    console.log(`  Default password: ${defaultPassword} (change immediately!)`);
  }

  // 2. Migrate investments
  const investments = readJson<any>(path.join(DATA_DIR, "investments.json"));
  let investmentCount = 0;
  for (const inv of investments) {
    try {
      db.insert(schema.investments)
        .values({
          id: inv.id,
          userId,
          name: inv.name,
          amount: inv.amount,
          currency: inv.currency || null,
          originalAmount: inv.originalAmount || null,
          originalCurrency: inv.originalCurrency || null,
          type: inv.type,
          assetType: inv.assetType || null,
          startDate: inv.startDate,
          endDate: inv.endDate || null,
          maturityDate: inv.maturityDate || null,
          maturityAmount: inv.maturityAmount || null,
          originalMaturityAmount: inv.originalMaturityAmount || null,
          interestRate: inv.interestRate || null,
          ruleLabel: inv.ruleLabel || null,
          ruleFormula: inv.ruleFormula || null,
          description: inv.description || null,
          status: inv.status || "active",
          isPublished: inv.isPublished ?? true,
          tags: inv.tags || null,
          createdAt: inv.createdAt,
          updatedAt: inv.updatedAt,
        })
        .run();
      investmentCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping investment ${inv.id}: ${e.message}`);
      }
    }
  }
  console.log(`Investments: ${investmentCount}/${investments.length}`);

  // 3. Migrate loans
  const loansData = readJson<any>(path.join(DATA_DIR, "loans.json"));
  let loanCount = 0;
  for (const loan of loansData) {
    try {
      db.insert(schema.loans)
        .values({
          id: loan.id,
          userId,
          name: loan.name,
          type: loan.type,
          principalAmount: loan.principalAmount,
          outstandingAmount: loan.outstandingAmount,
          interestRate: loan.interestRate,
          startDate: loan.startDate,
          endDate: loan.endDate || null,
          emiAmount: loan.emiAmount,
          emiDate: loan.emiDate,
          tenureMonths: loan.tenureMonths,
          description: loan.description || null,
          status: loan.status || "active",
          isPublished: loan.isPublished ?? true,
          createdAt: loan.createdAt,
          updatedAt: loan.updatedAt,
        })
        .run();
      loanCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping loan ${loan.id}: ${e.message}`);
      }
    }
  }
  console.log(`Loans: ${loanCount}/${loansData.length}`);

  // 4. Migrate properties
  const properties = readJson<any>(path.join(DATA_DIR, "properties.json"));
  let propCount = 0;
  for (const p of properties) {
    try {
      db.insert(schema.properties)
        .values({
          id: p.id,
          userId,
          name: p.name,
          type: p.type,
          assetType: p.assetType || null,
          purchasePrice: p.purchasePrice,
          currentValue: p.currentValue || null,
          purchaseDate: p.purchaseDate,
          location: p.location,
          description: p.description || null,
          status: p.status || "owned",
          isPublished: p.isPublished ?? true,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })
        .run();
      propCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping property ${p.id}: ${e.message}`);
      }
    }
  }
  console.log(`Properties: ${propCount}/${properties.length}`);

  // 5. Migrate bank balances
  const bankBalances = readJson<any>(path.join(DATA_DIR, "bankBalances.json"));
  let bbCount = 0;
  for (const bb of bankBalances) {
    try {
      db.insert(schema.bankBalances)
        .values({
          id: bb.id,
          userId,
          bankName: bb.bankName,
          accountNumber: bb.accountNumber || null,
          accountType: bb.accountType,
          assetType: bb.assetType || null,
          balance: bb.balance,
          currency: bb.currency || "INR",
          originalAmount: bb.originalAmount || null,
          originalCurrency: bb.originalCurrency || null,
          lastUpdated: bb.lastUpdated,
          description: bb.description || null,
          status: bb.status || "active",
          isPublished: bb.isPublished ?? true,
          issueDate: bb.issueDate || null,
          dueDate: bb.dueDate || null,
          interestRate: bb.interestRate || null,
          paidDate: bb.paidDate || null,
          tags: bb.tags || null,
          createdAt: bb.createdAt,
          updatedAt: bb.updatedAt,
        })
        .run();
      bbCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping bank balance ${bb.id}: ${e.message}`);
      }
    }
  }
  console.log(`Bank Balances: ${bbCount}/${bankBalances.length}`);

  // 6. Migrate transactions
  const txns = readJson<any>(path.join(DATA_DIR, "transactions.json"));
  let txnCount = 0;
  for (const t of txns) {
    try {
      db.insert(schema.transactions)
        .values({
          id: t.id,
          userId,
          date: t.date,
          amount: t.amount,
          description: t.description,
          category: t.category,
          type: t.type,
          balance: t.balance || null,
          account: t.account || null,
          source: t.source,
          qualityGrade: t.qualityGrade || null,
          createdAt: t.createdAt || new Date().toISOString(),
        })
        .run();
      txnCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping transaction ${t.id}: ${e.message}`);
      }
    }
  }
  console.log(`Transactions: ${txnCount}/${txns.length}`);

  // 7. Migrate PPF accounts
  const ppfPath = path.join(PF_DIR, "ppfAccounts.json");
  const ppfAccounts = readJson<any>(ppfPath);
  let ppfCount = 0;
  for (const a of ppfAccounts) {
    try {
      db.insert(schema.ppfAccounts)
        .values({
          id: a.id,
          userId,
          memberId: a.memberId || null,
          memberName: a.memberName || null,
          establishmentId: a.establishmentId || null,
          establishmentName: a.establishmentName || null,
          depositEmployeeShare: a.depositEmployeeShare ?? 0,
          depositEmployerShare: a.depositEmployerShare ?? 0,
          withdrawEmployeeShare: a.withdrawEmployeeShare ?? 0,
          withdrawEmployerShare: a.withdrawEmployerShare ?? 0,
          pensionContribution: a.pensionContribution ?? 0,
          grandTotal: a.grandTotal ?? 0,
          extractedFrom: a.extractedFrom || null,
          extractedAt: a.extractedAt,
          lastUpdated: a.lastUpdated || null,
          rawData: a.rawData || null,
        })
        .run();
      ppfCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping PPF ${a.id}: ${e.message}`);
      }
    }
  }
  console.log(`PPF Accounts: ${ppfCount}/${ppfAccounts.length}`);

  // 8. Migrate loan analytics snapshots
  const analyticsPath = path.join(LOANS_DIR, "loanAnalytics.json");
  const loanSnapshots = readJson<any>(analyticsPath);
  let lsCount = 0;
  for (const s of loanSnapshots) {
    try {
      db.insert(schema.loanSnapshots)
        .values({
          id: s.id,
          userId,
          loanId: s.loanId,
          year: s.year,
          month: s.month,
          outstandingAmount: s.outstandingAmount,
          principalPaid: s.principalPaid,
          interestPaid: s.interestPaid,
          emiAmount: s.emiAmount,
          interestRate: s.interestRate,
          remainingTenureMonths: s.remainingTenureMonths,
          snapshotDate: s.snapshotDate,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })
        .run();
      lsCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping loan snapshot ${s.id}: ${e.message}`);
      }
    }
  }
  console.log(`Loan Snapshots: ${lsCount}/${loanSnapshots.length}`);

  // 9. Migrate financial archive
  const archive = readJson<any>(path.join(DATA_DIR, "financialArchive.json"));
  let archCount = 0;
  for (const s of archive) {
    try {
      db.insert(schema.financialSnapshots)
        .values({
          id: s.id,
          userId,
          year: s.year,
          month: s.month ?? null,
          period: s.period,
          snapshotDate: s.snapshotDate,
          totalInvestments: s.totalInvestments ?? 0,
          totalLoans: s.totalLoans ?? 0,
          totalProperties: s.totalProperties ?? 0,
          totalBankBalances: s.totalBankBalances ?? 0,
          totalReceivables: s.totalReceivables ?? 0,
          totalStocks: s.totalStocks ?? 0,
          totalMutualFunds: s.totalMutualFunds ?? 0,
          totalPPF: s.totalPPF ?? 0,
          totalFixedAssets: s.totalFixedAssets ?? 0,
          totalLiquidAssets: s.totalLiquidAssets ?? 0,
          netWorth: s.netWorth ?? 0,
          totalIncome: s.totalIncome ?? 0,
          totalExpenses: s.totalExpenses ?? 0,
          netBalance: s.netBalance ?? 0,
          investmentBreakdown: s.investmentBreakdown || null,
          loanBreakdown: s.loanBreakdown || null,
          propertyBreakdown: s.propertyBreakdown || null,
          categoryBreakdown: s.categoryBreakdown || null,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })
        .run();
      archCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping archive ${s.id}: ${e.message}`);
      }
    }
  }
  console.log(`Financial Snapshots: ${archCount}/${archive.length}`);

  // 10. Migrate portfolio categories
  const categories = readJson<any>(path.join(DATA_DIR, "portfolioCategories.json"));
  let catCount = 0;
  for (const c of categories) {
    try {
      db.insert(schema.portfolioCategories)
        .values({
          id: c.id,
          userId,
          name: c.name,
          slug: c.slug,
          icon: c.icon || null,
          href: c.href,
          type: c.type,
          description: c.description || null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })
        .run();
      catCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping category ${c.id}: ${e.message}`);
      }
    }
  }
  console.log(`Portfolio Categories: ${catCount}/${categories.length}`);

  // 11. Migrate stocks
  const stocksData = readJsonObj(path.join(DATA_DIR, "stocks.json"));
  const stocksList = stocksData?.stocks || (Array.isArray(stocksData) ? stocksData : []);
  let stockCount = 0;
  for (const s of stocksList) {
    try {
      db.insert(schema.stocks)
        .values({
          userId,
          tradingsymbol: s.tradingsymbol,
          exchange: s.exchange,
          instrumentToken: s.instrument_token?.toString() || "",
          quantity: s.quantity,
          averagePrice: s.average_price,
          lastPrice: s.last_price,
          pnl: s.pnl,
          pnlPercentage: s.pnl_percentage,
          lastUpdated: stocksData?.lastUpdated || new Date().toISOString(),
        })
        .run();
      stockCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping stock ${s.tradingsymbol}: ${e.message}`);
      }
    }
  }
  console.log(`Stocks: ${stockCount}/${stocksList.length}`);

  // 12. Migrate mutual funds
  const mfData = readJsonObj(path.join(DATA_DIR, "mutualFunds.json"));
  const mfList = mfData?.mutualFunds || (Array.isArray(mfData) ? mfData : []);
  let mfCount = 0;
  for (const m of mfList) {
    try {
      db.insert(schema.mutualFunds)
        .values({
          userId,
          tradingsymbol: m.tradingsymbol,
          fundName: m.fund_name,
          folio: m.folio,
          quantity: m.quantity,
          averagePrice: m.average_price,
          lastPrice: m.last_price,
          pnl: m.pnl,
          pnlPercentage: m.pnl_percentage,
          lastUpdated: mfData?.lastUpdated || new Date().toISOString(),
        })
        .run();
      mfCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping MF ${m.tradingsymbol}: ${e.message}`);
      }
    }
  }
  console.log(`Mutual Funds: ${mfCount}/${mfList.length}`);

  // 13. Migrate processed emails
  const processedEmails = readJson<any>(path.join(DATA_DIR, "processed-emails.json"));
  let peCount = 0;
  for (const pe of processedEmails) {
    try {
      db.insert(schema.processedEmails)
        .values({
          userId,
          emailId: pe.emailId || pe.id,
          processedAt: pe.processedAt || new Date().toISOString(),
          investmentId: pe.investmentId || null,
        })
        .run();
      peCount++;
    } catch (e: any) {
      if (!e.message?.includes("UNIQUE constraint")) {
        console.log(`  Skipping processed email: ${e.message}`);
      }
    }
  }
  console.log(`Processed Emails: ${peCount}/${processedEmails.length}`);

  // 14. Migrate Zerodha env vars to user_configurations
  const zerodhaApiKey = process.env.ZERODHA_API_KEY;
  const zerodhaApiSecret = process.env.ZERODHA_API_SECRET;
  if (zerodhaApiKey) {
    try {
      const { setConfig } = await import("../core/db/repositories/userConfigRepository");
      setConfig(userId, "zerodha", "api_key", zerodhaApiKey);
      if (zerodhaApiSecret) {
        setConfig(userId, "zerodha", "api_secret", zerodhaApiSecret);
      }
      console.log("Zerodha credentials migrated to user_configurations");
    } catch (e) {
      console.log("  Could not migrate Zerodha credentials:", e);
    }
  }

  console.log("\n=== Migration Complete ===");
  console.log(`User: ${emailArg} (${userId})`);

  sqlite.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
