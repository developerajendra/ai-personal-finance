/**
 * Read-only schema preflight (and optional backup) for the hosted Turso database.
 *
 * Compares the migrations in ./drizzle with what the target database has applied, then checks
 * every pending statement against the live schema so `npm run db:migrate` can't fail halfway
 * through for a predictable reason (table/column/index already exists, NOT NULL column on a
 * non-empty table, duplicate rows under a new unique index). Never writes to the database.
 *
 * Usage:
 *   node scripts/db-preflight.mjs                       # check only
 *   node scripts/db-preflight.mjs --backup              # check + SQL dump to ./backups (verified by restoring it)
 *   node scripts/db-preflight.mjs --env-file .env.production.local
 *
 * Credentials come from --env-file (default .env.production.local, e.g. from
 * `vercel env pull .env.production.local --environment=production`) or the environment.
 * Only the database host is printed, never the auth token.
 */

import { createClient } from "@libsql/client";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

// ── Credentials ──────────────────────────────────────────────────────────────
function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const envFile = path.resolve(root, opt("--env-file", ".env.production.local"));
const fileEnv = loadEnv(envFile);
const url = fileEnv.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
const authToken = fileEnv.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error(`✖ TURSO_DATABASE_URL not found in ${path.relative(root, envFile)} or the environment.`);
  process.exit(1);
}
if (url.startsWith("file:") && !flag("--allow-local")) {
  console.error("✖ Target is a local file, not the hosted database. Pass --allow-local to check it anyway.");
  process.exit(1);
}
const host = url.startsWith("file:") ? url : new URL(url.replace(/^libsql:/, "https:")).host;
console.log(`Target database: ${host}${authToken ? " (auth token loaded, not shown)" : ""}`);

const db = createClient({ url, authToken });
const q = async (sql, params = []) => (await db.execute({ sql, args: params })).rows;
const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

// ── Live schema ──────────────────────────────────────────────────────────────
const objects = await q("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'");
const tables = new Set(objects.filter((o) => o.type === "table").map((o) => o.name));
const indexes = new Set(objects.filter((o) => o.type === "index").map((o) => o.name));
const columnCache = new Map();
async function columns(table) {
  if (!columnCache.has(table)) columnCache.set(table, new Set((await q(`PRAGMA table_info(${ident(table)})`)).map((c) => c.name)));
  return columnCache.get(table);
}

// ── Migrations: local journal vs applied ─────────────────────────────────────
const journal = JSON.parse(fs.readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"));
const local = journal.entries.map((e) => {
  const sql = fs.readFileSync(path.join(root, "drizzle", `${e.tag}.sql`), "utf8");
  return { tag: e.tag, when: e.when, hash: crypto.createHash("sha256").update(sql).digest("hex"), statements: sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean) };
});

const problems = [];
const warnings = [];
let applied = [];
if (tables.has("__drizzle_migrations")) {
  applied = await q('SELECT hash, created_at FROM "__drizzle_migrations" ORDER BY created_at');
} else if (tables.has("users")) {
  problems.push(
    "No __drizzle_migrations table, but app tables exist (schema was created with `push` or by hand). " +
      "`db:migrate` would re-run 0000 and fail. Baseline the applied migrations first (see docs/production-migrations.md).",
  );
}
const last = applied.length ? Math.max(...applied.map((r) => Number(r.created_at))) : -Infinity;
const appliedHashes = new Set(applied.map((r) => r.hash));

console.log("\nMigrations:");
for (const m of local) {
  const done = m.when <= last;
  console.log(`  ${done ? "✔ applied" : "• pending"}  ${m.tag}`);
  if (done && !appliedHashes.has(m.hash)) warnings.push(`${m.tag} is recorded as applied but its file differs from the recorded hash (edited after it ran?).`);
}
const pending = local.filter((m) => m.when > last);

// ── Check each pending statement against the live schema ─────────────────────
// Objects created earlier in the same run count as existing for later statements.
const willCreateTables = new Set();
const willAddColumns = new Map();
for (const m of pending) {
  for (const stmt of m.statements) {
    let r;
    if ((r = stmt.match(/^CREATE TABLE\s+`([^`]+)`/i))) {
      if (tables.has(r[1])) problems.push(`${m.tag}: table ${r[1]} already exists.`);
      willCreateTables.add(r[1]);
    } else if ((r = stmt.match(/^ALTER TABLE\s+`([^`]+)`\s+ADD\s+`([^`]+)`\s+(.*)$/is))) {
      const [, table, col, def] = r;
      if (!tables.has(table) && !willCreateTables.has(table)) problems.push(`${m.tag}: ALTER on missing table ${table}.`);
      else if (tables.has(table) && (await columns(table)).has(col)) problems.push(`${m.tag}: column ${table}.${col} already exists.`);
      else if (tables.has(table) && /NOT NULL/i.test(def) && !/DEFAULT/i.test(def)) {
        const [{ n }] = await q(`SELECT count(*) AS n FROM ${ident(table)}`);
        if (Number(n) > 0) problems.push(`${m.tag}: ${table}.${col} is NOT NULL without a default and the table has ${n} rows.`);
      }
      willAddColumns.set(table, new Set([...(willAddColumns.get(table) ?? []), col]));
    } else if ((r = stmt.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+`([^`]+)`\s+ON\s+`([^`]+)`\s*\(([^)]+)\)/i))) {
      const [, unique, name, table, colList] = r;
      if (indexes.has(name)) problems.push(`${m.tag}: index ${name} already exists.`);
      const cols = colList.split(",").map((c) => c.trim().replace(/`/g, ""));
      const newCols = willAddColumns.get(table) ?? new Set();
      // Columns added in this run are NULL on every existing row, and NULLs never collide.
      if (unique && tables.has(table) && !cols.some((c) => newCols.has(c))) {
        const list = cols.map(ident).join(", ");
        const [{ n }] = await q(
          `SELECT count(*) AS n FROM (SELECT 1 FROM ${ident(table)} WHERE ${cols.map((c) => `${ident(c)} IS NOT NULL`).join(" AND ")} GROUP BY ${list} HAVING count(*) > 1)`,
        );
        if (Number(n) > 0) problems.push(`${m.tag}: ${n} duplicate (${cols.join(", ")}) groups in ${table} would break unique index ${name}.`);
      }
    } else if (/^\s*(DROP|DELETE|UPDATE|INSERT|PRAGMA)\b/i.test(stmt) || /__new_|RENAME/i.test(stmt)) {
      warnings.push(`${m.tag}: contains a non-additive statement: ${stmt.split("\n")[0].slice(0, 100)}`);
    }
  }
}

if (pending.length) {
  console.log("\nPending statements:");
  for (const m of pending) for (const s of m.statements) console.log(`  [${m.tag}] ${s.split("\n")[0].slice(0, 110)}`);
}

// ── Row counts (compare before/after) ────────────────────────────────────────
console.log("\nRow counts:");
const counts = {};
for (const t of [...tables].filter((t) => t !== "__drizzle_migrations").sort()) {
  const [{ n }] = await q(`SELECT count(*) AS n FROM ${ident(t)}`);
  counts[t] = Number(n);
  console.log(`  ${t.padEnd(32)} ${counts[t]}`);
}

// ── Backup ───────────────────────────────────────────────────────────────────
function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return `X'${Buffer.from(v instanceof ArrayBuffer ? v : v.buffer).toString("hex")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}
if (flag("--backup")) {
  const dir = path.join(root, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `db-${host.replace(/[^a-z0-9.-]/gi, "_")}-${stamp}.sql`);
  const out = fs.createWriteStream(file);
  out.write(`-- Backup of ${host} at ${new Date().toISOString()}\nPRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n`);
  for (const o of objects.filter((o) => o.type === "table" && o.sql)) {
    out.write(`${o.sql};\n`);
    const rows = await db.execute(`SELECT * FROM ${ident(o.name)}`);
    for (const row of rows.rows) {
      out.write(`INSERT INTO ${ident(o.name)} (${rows.columns.map(ident).join(",")}) VALUES (${rows.columns.map((c) => lit(row[c])).join(",")});\n`);
    }
  }
  for (const o of objects.filter((o) => o.type !== "table" && o.sql)) out.write(`${o.sql};\n`);
  out.write("COMMIT;\n");
  await new Promise((res) => out.end(res));

  // Prove the dump restores: load it into a scratch file and compare row counts.
  const scratch = path.join(dir, `.verify-${stamp}.db`);
  const check = createClient({ url: `file:${scratch}` });
  await check.executeMultiple(fs.readFileSync(file, "utf8"));
  const mismatched = [];
  for (const [t, n] of Object.entries(counts)) {
    const [{ c }] = (await check.execute(`SELECT count(*) AS c FROM ${ident(t)}`)).rows;
    if (Number(c) !== n) mismatched.push(`${t}: ${c} restored vs ${n} live`);
  }
  check.close();
  fs.rmSync(scratch, { force: true });
  if (mismatched.length) {
    console.error(`\n✖ Backup written but restore check failed:\n  ${mismatched.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`\n✔ Backup written and verified by restore: ${path.relative(root, file)}`);
}

db.close();

// ── Verdict ──────────────────────────────────────────────────────────────────
for (const w of warnings) console.log(`\n⚠ ${w}`);
if (problems.length) {
  console.error(`\n✖ Not safe to migrate yet:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(pending.length ? `\n✔ ${pending.length} pending migration(s); all statements are additive and none conflict. Safe to run \`npm run db:migrate\`.` : "\n✔ Schema is up to date. Nothing to migrate.");
