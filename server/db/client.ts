import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

/**
 * Database client.
 * - Local dev: uses file:./data/app.db  (no TURSO_DATABASE_URL needed)
 * - Vercel / production: uses Turso cloud via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
 */
const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./data/app.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

export type Db = typeof db;
/** A transaction handle passed to `db.transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Anything that can run queries: the root client or an open transaction. */
export type Executor = Db | Tx;
