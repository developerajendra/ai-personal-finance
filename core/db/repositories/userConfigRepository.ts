import { db } from "@/core/db";
import { userConfigurations } from "@/core/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || "change-me-to-a-32-byte-hex-key!!";
  return Buffer.from(key.padEnd(32, "0").slice(0, 32));
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text: string): string {
  const parts = text.split(":");
  const iv = Buffer.from(parts.shift()!, "hex");
  const encrypted = parts.join(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export interface UserConfig {
  provider: string;
  configKey: string;
  configValue: string;
}

export function getConfig(userId: string, provider: string, configKey: string): string | null {
  const [row] = db
    .select()
    .from(userConfigurations)
    .where(
      and(
        eq(userConfigurations.userId, userId),
        eq(userConfigurations.provider, provider),
        eq(userConfigurations.configKey, configKey)
      )
    )
    .limit(1)
    .all();
  return row ? decrypt(row.configValue) : null;
}

export function setConfig(userId: string, provider: string, configKey: string, configValue: string): void {
  const encrypted = encrypt(configValue);
  const [existing] = db
    .select()
    .from(userConfigurations)
    .where(
      and(
        eq(userConfigurations.userId, userId),
        eq(userConfigurations.provider, provider),
        eq(userConfigurations.configKey, configKey)
      )
    )
    .limit(1)
    .all();

  if (existing) {
    db.update(userConfigurations)
      .set({ configValue: encrypted, updatedAt: new Date().toISOString() })
      .where(eq(userConfigurations.id, existing.id))
      .run();
  } else {
    db.insert(userConfigurations)
      .values({ userId, provider, configKey, configValue: encrypted })
      .run();
  }
}

export function deleteConfig(userId: string, provider: string, configKey: string): boolean {
  const result = db
    .delete(userConfigurations)
    .where(
      and(
        eq(userConfigurations.userId, userId),
        eq(userConfigurations.provider, provider),
        eq(userConfigurations.configKey, configKey)
      )
    )
    .run();
  return result.changes > 0;
}

export function getConfigsByProvider(userId: string, provider: string): UserConfig[] {
  const rows = db
    .select()
    .from(userConfigurations)
    .where(and(eq(userConfigurations.userId, userId), eq(userConfigurations.provider, provider)))
    .all();
  return rows.map((r) => ({
    provider: r.provider,
    configKey: r.configKey,
    configValue: decrypt(r.configValue),
  }));
}

export function deleteAllByProvider(userId: string, provider: string): void {
  db.delete(userConfigurations)
    .where(and(eq(userConfigurations.userId, userId), eq(userConfigurations.provider, provider)))
    .run();
}
