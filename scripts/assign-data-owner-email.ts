/**
 * Point migrated / default app data at your real Google account email.
 *
 * - If only `fromEmail` exists: renames that user to `toEmail` (same user id → all data stays).
 * - If both exist (e.g. admin + separate Google signup): merges OAuth + rows from `toEmail`
 *   user into the `fromEmail` user, deletes the duplicate, then sets email to `toEmail`.
 *
 * Usage:
 *   npx tsx scripts/assign-data-owner-email.ts [fromEmail] [toEmail]
 *
 * Defaults: admin@example.com → developer.rajan@gmail.com
 */

import path from "path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../core/db/schema";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

const DATA_TABLES = [
  schema.investments,
  schema.loans,
  schema.properties,
  schema.bankBalances,
  schema.transactions,
  schema.ppfAccounts,
  schema.loanSnapshots,
  schema.financialSnapshots,
  schema.portfolioCategories,
  schema.userConfigurations,
  schema.processedEmails,
  schema.stocks,
  schema.mutualFunds,
] as const;

function main() {
  const fromEmail = process.argv[2] || "admin@example.com";
  const toEmail = process.argv[3] || "developer.rajan@gmail.com";

  console.log("=== Assign data owner email ===\n");
  console.log(`  From: ${fromEmail}`);
  console.log(`  To:   ${toEmail}\n`);

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

  const [oldUser] = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, fromEmail))
    .limit(1)
    .all();

  const [newUser] = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, toEmail))
    .limit(1)
    .all();

  if (!oldUser && !newUser) {
    console.error(`No user found with email "${fromEmail}" or "${toEmail}".`);
    console.error("Create a user first (register or sign in), or fix the emails.");
    sqlite.close();
    process.exit(1);
  }

  if (oldUser && !newUser) {
    db.update(schema.users)
      .set({
        email: toEmail,
        name: oldUser.name ?? "Developer",
      })
      .where(eq(schema.users.id, oldUser.id))
      .run();
    console.log(`Updated user ${oldUser.id}: ${fromEmail} → ${toEmail}`);
    console.log("Google sign-in will match this user; all existing data stays on the same id.");
    sqlite.close();
    return;
  }

  if (!oldUser && newUser) {
    console.log(`Only "${toEmail}" exists; nothing to move from "${fromEmail}".`);
    sqlite.close();
    return;
  }

  // Both exist: keep oldUser id (assumed to hold migrated data), fold in Google user.
  const dataOwnerId = oldUser!.id;
  const duplicateId = newUser!.id;

  console.log(`Merging user ${duplicateId} (${toEmail}) → ${dataOwnerId} (${fromEmail})…`);

  db.update(schema.accounts)
    .set({ userId: dataOwnerId })
    .where(eq(schema.accounts.userId, duplicateId))
    .run();

  for (const table of DATA_TABLES) {
    db.update(table).set({ userId: dataOwnerId }).where(eq(table.userId, duplicateId)).run();
  }

  db.delete(schema.sessions).where(eq(schema.sessions.userId, duplicateId)).run();
  db.delete(schema.users).where(eq(schema.users.id, duplicateId)).run();

  db.update(schema.users)
    .set({
      email: toEmail,
      name: oldUser!.name ?? newUser!.name ?? "Developer",
      image: oldUser!.image ?? newUser!.image ?? null,
      emailVerified: oldUser!.emailVerified ?? newUser!.emailVerified ?? null,
    })
    .where(eq(schema.users.id, dataOwnerId))
    .run();

  console.log(`Done. Single user ${dataOwnerId} with email ${toEmail} owns all data and linked accounts.`);
  sqlite.close();
}

main();
