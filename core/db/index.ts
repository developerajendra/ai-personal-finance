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
