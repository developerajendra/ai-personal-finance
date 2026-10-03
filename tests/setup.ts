import { mkdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll } from "vitest";

/**
 * Every test file gets a fresh SQLite file with all migrations applied, so
 * tests exercise the real schema (unique indexes, FKs) and never touch the
 * developer or production database.
 */
const dir = path.join(tmpdir(), "pf-ai-tests");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${randomUUID()}.db`);
process.env.TURSO_DATABASE_URL = `file:${file}`;
delete process.env.TURSO_AUTH_TOKEN;
// Never let tests reach a real AI provider or WhatsApp.
for (const key of ["ANTHROPIC_API_KEY", "LLM_API_KEY", "OPENAI_API_KEY", "AI_CHAT_API_KEY", "WHATSAPP_ACCESS_TOKEN"]) {
  delete process.env[key];
}

beforeAll(async () => {
  const client = createClient({ url: `file:${file}` });
  await migrate(drizzle(client), { migrationsFolder: path.resolve(__dirname, "../drizzle") });
  client.close();
});
