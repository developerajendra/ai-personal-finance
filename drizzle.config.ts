import type { Config } from "drizzle-kit";

/**
 * Drizzle config:
 * - Local dev: TURSO_DATABASE_URL is unset → uses local SQLite file
 * - Production: TURSO_DATABASE_URL is set → uses Turso cloud database
 */
export default {
  schema: "./core/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:./data/app.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
