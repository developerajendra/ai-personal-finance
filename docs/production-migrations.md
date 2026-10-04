# Applying database migrations to Production (Turso)

Vercel deploys code but never runs migrations. After promoting a version that adds files in
`drizzle/`, the hosted database must be migrated, or routes that touch the new columns or
tables fail with `no such column` / `no such table` (HTTP 500).

Pending migrations are applied atomically: drizzle sends all pending statements and their
`__drizzle_migrations` rows to libsql as one batch, so a failure leaves the schema unchanged.
No existing table is dropped, rebuilt or reset by `0001`–`0003`; they only add tables,
nullable columns and indexes.

## Steps

Run from the repo root, on the commit that is deployed to Production.

1. **Get the Production credentials** (written to a git-ignored file, never printed):

   ```bash
   vercel env pull .env.production.local --environment=production
   ```

   If `TURSO_AUTH_TOKEN` comes back empty (sensitive variables can't be pulled), create a
   token with `turso db tokens create <database-name>` and paste it into that file.

2. **Preflight (read-only).** Confirm the printed `Target database` host is the one set as
   `TURSO_DATABASE_URL` for Production in Vercel, and that the row counts look like your data:

   ```bash
   npm run db:preflight
   ```

   It lists applied/pending migrations, checks every pending statement against the live
   schema, and exits non-zero if anything would conflict. Do not continue if it fails.

3. **Back up.** Writes `backups/db-<host>-<timestamp>.sql` and proves it by restoring it into a
   scratch database and comparing row counts:

   ```bash
   npm run db:preflight -- --backup
   ```

   Optionally also keep a server-side copy: `turso db create <name>-pre-migration --from-db <name>`.

4. **Migrate** with the project's migration command, passing only the two Turso variables:

   ```bash
   env $(grep -E '^TURSO_(DATABASE_URL|AUTH_TOKEN)=' .env.production.local | xargs) npm run db:migrate
   ```

5. **Confirm.** Preflight should now say `Schema is up to date` with the same row counts as
   step 2 (plus the new, empty tables):

   ```bash
   npm run db:preflight
   ```

No redeploy is needed; the running deployment picks up the new schema on the next request.
Delete `.env.production.local` afterwards if you don't need it, and keep the backup file
somewhere private (it contains your financial data).

## Restoring the backup

Only if something went wrong. Restore into a **new** database and point Vercel at it, rather
than overwriting Production:

```bash
turso db create <name>-restore
turso db shell <name>-restore < backups/<file>.sql
```

## If preflight reports “No __drizzle_migrations table”

The database was created with `drizzle-kit push` or by hand, so drizzle doesn't know which
migrations it already has, and `db:migrate` would try to re-create existing tables (it fails
safely, but nothing gets applied). Don't run `push` against Production. Instead, compare the
live schema with each migration file, record the ones already reflected as applied in
`__drizzle_migrations` (hash = sha256 of the `.sql` file, `created_at` = the journal `when`),
then rerun the preflight. Ask for help with this step if unsure.
