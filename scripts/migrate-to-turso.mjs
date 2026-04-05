/**
 * Migration script: copies all data for developer.rajan@gmail.com
 * from local SQLite (data/app.db) into Turso cloud DB.
 *
 * Usage:
 *   node scripts/migrate-to-turso.mjs
 */

import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── Load Turso credentials from .env.production.local ─────────────────────────
const envFile = path.join(root, ".env.production.local");
const envVars = {};
for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const TURSO_URL = envVars["TURSO_DATABASE_URL"];
const TURSO_TOKEN = envVars["TURSO_AUTH_TOKEN"];
const LOCAL_DB_PATH = path.join(root, "data", "app.db");
const LOCAL_USER_EMAIL = "developer.rajan@gmail.com";

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("❌  Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env.production.local");
  process.exit(1);
}

// ── 1. Open local SQLite ──────────────────────────────────────────────────────
const localDb = new Database(LOCAL_DB_PATH, { readonly: true });
const localUser = localDb.prepare("SELECT * FROM users WHERE email = ?").get(LOCAL_USER_EMAIL);

if (!localUser) {
  console.error(`❌  User ${LOCAL_USER_EMAIL} not found in local DB`);
  process.exit(1);
}
const OLD_USER_ID = localUser.id;
console.log(`✅  Local user: ${OLD_USER_ID} (${localUser.name})`);

// ── 2. Connect to Turso ───────────────────────────────────────────────────────
const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

// ── 3. Find or create the user in Turso ──────────────────────────────────────
const tursoUserRows = await turso.execute({
  sql: "SELECT id FROM users WHERE email = ?",
  args: [LOCAL_USER_EMAIL],
});

let NEW_USER_ID;
if (tursoUserRows.rows.length > 0) {
  NEW_USER_ID = String(tursoUserRows.rows[0].id);
  console.log(`✅  Turso user exists: ${NEW_USER_ID}`);
} else {
  NEW_USER_ID = OLD_USER_ID; // reuse same UUID
  await turso.execute({
    sql: `INSERT OR IGNORE INTO users (id, name, email, email_verified, image, hashed_password, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      NEW_USER_ID,
      localUser.name,
      localUser.email,
      localUser.email_verified ?? null,
      localUser.image ?? null,
      localUser.hashed_password ?? null,
      localUser.created_at ?? new Date().toISOString(),
      localUser.updated_at ?? new Date().toISOString(),
    ],
  });
  console.log(`✅  Created user in Turso: ${NEW_USER_ID}`);
}

// ── 4. Helper ─────────────────────────────────────────────────────────────────
async function migrate(label, rows, insertFn) {
  if (!rows.length) { console.log(`   ⏭  ${label}: 0 rows`); return; }
  let ok = 0, skip = 0;
  for (const r of rows) {
    try { await insertFn(r); ok++; }
    catch (e) {
      if (e.message?.includes("UNIQUE") || e.message?.includes("ALREADY")) skip++;
      else { console.warn(`   ⚠️  ${label}: ${e.message}`); skip++; }
    }
  }
  console.log(`   ✅  ${label}: ${ok} inserted, ${skip} skipped`);
}

console.log("\n📦  Migrating...\n");

// ── investments ───────────────────────────────────────────────────────────────
await migrate("investments",
  localDb.prepare("SELECT * FROM investments WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO investments
            (id,user_id,name,amount,currency,original_amount,original_currency,type,asset_type,
             start_date,end_date,maturity_date,maturity_amount,original_maturity_amount,
             interest_rate,rule_label,rule_formula,description,status,is_published,tags,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.name,r.amount,r.currency,r.original_amount,r.original_currency,
      r.type,r.asset_type,r.start_date,r.end_date,r.maturity_date,r.maturity_amount,
      r.original_maturity_amount,r.interest_rate,r.rule_label,r.rule_formula,r.description,
      r.status,r.is_published,r.tags,r.created_at,r.updated_at],
  })
);

// ── bank_balances ─────────────────────────────────────────────────────────────
await migrate("bank_balances",
  localDb.prepare("SELECT * FROM bank_balances WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO bank_balances
            (id,user_id,bank_name,account_number,account_type,asset_type,balance,currency,
             original_amount,original_currency,last_updated,description,status,is_published,
             issue_date,due_date,interest_rate,paid_date,tags,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.bank_name,r.account_number,r.account_type,r.asset_type,
      r.balance,r.currency,r.original_amount,r.original_currency,r.last_updated,
      r.description,r.status,r.is_published,r.issue_date,r.due_date,r.interest_rate,
      r.paid_date,r.tags,r.created_at,r.updated_at],
  })
);

// ── loans ─────────────────────────────────────────────────────────────────────
await migrate("loans",
  localDb.prepare("SELECT * FROM loans WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO loans
            (id,user_id,name,type,principal_amount,outstanding_amount,interest_rate,
             start_date,end_date,emi_amount,emi_date,tenure_months,description,
             status,is_published,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.name,r.type,r.principal_amount,r.outstanding_amount,
      r.interest_rate,r.start_date,r.end_date,r.emi_amount,r.emi_date,r.tenure_months,
      r.description,r.status,r.is_published,r.created_at,r.updated_at],
  })
);

// ── loan_snapshots ────────────────────────────────────────────────────────────
await migrate("loan_snapshots",
  localDb.prepare("SELECT * FROM loan_snapshots WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO loan_snapshots
            (id,user_id,loan_id,year,month,outstanding_amount,principal_paid,interest_paid,
             emi_amount,interest_rate,remaining_tenure_months,snapshot_date,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.loan_id,r.year,r.month,r.outstanding_amount,r.principal_paid,
      r.interest_paid,r.emi_amount,r.interest_rate,r.remaining_tenure_months,r.snapshot_date,
      r.created_at,r.updated_at],
  })
);

// ── mutual_funds ──────────────────────────────────────────────────────────────
await migrate("mutual_funds",
  localDb.prepare("SELECT * FROM mutual_funds WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO mutual_funds
            (id,user_id,tradingsymbol,fund_name,folio,quantity,average_price,
             last_price,pnl,pnl_percentage,last_updated)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.tradingsymbol,r.fund_name,r.folio,r.quantity,
      r.average_price,r.last_price,r.pnl,r.pnl_percentage,r.last_updated],
  })
);

// ── stocks ────────────────────────────────────────────────────────────────────
await migrate("stocks",
  localDb.prepare("SELECT * FROM stocks WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO stocks
            (id,user_id,tradingsymbol,exchange,instrument_token,quantity,average_price,
             last_price,pnl,pnl_percentage,last_updated)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.tradingsymbol,r.exchange,r.instrument_token,r.quantity,
      r.average_price,r.last_price,r.pnl,r.pnl_percentage,r.last_updated],
  })
);

// ── properties ────────────────────────────────────────────────────────────────
await migrate("properties",
  localDb.prepare("SELECT * FROM properties WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO properties
            (id,user_id,name,type,asset_type,purchase_price,current_value,
             purchase_date,location,description,status,is_published,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.name,r.type,r.asset_type,r.purchase_price,r.current_value,
      r.purchase_date,r.location,r.description,r.status,r.is_published,r.created_at,r.updated_at],
  })
);

// ── ppf_accounts ──────────────────────────────────────────────────────────────
await migrate("ppf_accounts",
  localDb.prepare("SELECT * FROM ppf_accounts WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO ppf_accounts
            (id,user_id,member_id,member_name,establishment_id,establishment_name,
             deposit_employee_share,deposit_employer_share,withdraw_employee_share,
             withdraw_employer_share,pension_contribution,grand_total,
             extracted_from,extracted_at,last_updated,raw_data)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.member_id,r.member_name,r.establishment_id,r.establishment_name,
      r.deposit_employee_share,r.deposit_employer_share,r.withdraw_employee_share,
      r.withdraw_employer_share,r.pension_contribution,r.grand_total,
      r.extracted_from,r.extracted_at,r.last_updated,r.raw_data],
  })
);

// ── financial_snapshots ───────────────────────────────────────────────────────
await migrate("financial_snapshots",
  localDb.prepare("SELECT * FROM financial_snapshots WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO financial_snapshots
            (id,user_id,year,month,period,snapshot_date,total_investments,total_loans,
             total_properties,total_bank_balances,total_receivables,total_stocks,
             total_mutual_funds,total_ppf,total_fixed_assets,total_liquid_assets,
             net_worth,total_income,total_expenses,net_balance,
             investment_breakdown,loan_breakdown,property_breakdown,category_breakdown,
             created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.year,r.month,r.period,r.snapshot_date,r.total_investments,
      r.total_loans,r.total_properties,r.total_bank_balances,r.total_receivables,r.total_stocks,
      r.total_mutual_funds,r.total_ppf,r.total_fixed_assets,r.total_liquid_assets,
      r.net_worth,r.total_income,r.total_expenses,r.net_balance,
      r.investment_breakdown,r.loan_breakdown,r.property_breakdown,r.category_breakdown,
      r.created_at,r.updated_at],
  })
);

// ── transactions ──────────────────────────────────────────────────────────────
await migrate("transactions",
  localDb.prepare("SELECT * FROM transactions WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO transactions
            (id,user_id,date,amount,description,category,type,balance,account,source,quality_grade,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.date,r.amount,r.description,r.category,r.type,
      r.balance,r.account,r.source,r.quality_grade,r.created_at],
  })
);

// ── portfolio_categories ──────────────────────────────────────────────────────
await migrate("portfolio_categories",
  localDb.prepare("SELECT * FROM portfolio_categories WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO portfolio_categories
            (id,user_id,name,slug,icon,href,type,description,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.name,r.slug,r.icon,r.href,r.type,r.description,r.created_at,r.updated_at],
  })
);

// ── processed_emails ──────────────────────────────────────────────────────────
await migrate("processed_emails",
  localDb.prepare("SELECT * FROM processed_emails WHERE user_id = ?").all(OLD_USER_ID),
  async (r) => turso.execute({
    sql: `INSERT OR IGNORE INTO processed_emails
            (id,user_id,email_id,processed_at,investment_id)
          VALUES (?,?,?,?,?)`,
    args: [r.id,NEW_USER_ID,r.email_id,r.processed_at,r.investment_id],
  })
);

localDb.close();

console.log("\n🎉  Migration complete!");
console.log(`   Local user ID : ${OLD_USER_ID}`);
console.log(`   Turso user ID : ${NEW_USER_ID}`);
if (OLD_USER_ID !== NEW_USER_ID) {
  console.log("\n   ⚠️  User IDs differ — updating JSON data files to use new ID...");
  // Update JSON files in data/ that reference the old user ID
  const dataDir = path.join(root, "data");
  const jsonFiles = fs.readdirSync(dataDir).filter(f => f.endsWith(".json"));
  for (const file of jsonFiles) {
    const fp = path.join(dataDir, file);
    const content = fs.readFileSync(fp, "utf8");
    if (content.includes(OLD_USER_ID)) {
      fs.writeFileSync(fp, content.replaceAll(OLD_USER_ID, NEW_USER_ID));
      console.log(`   📝  Updated ${file}`);
    }
  }
}
