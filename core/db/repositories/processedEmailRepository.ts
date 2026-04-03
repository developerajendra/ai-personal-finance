import { db } from "@/core/db";
import { processedEmails } from "@/core/db/schema";
import { eq, and } from "drizzle-orm";

export interface ProcessedEmail {
  emailId: string;
  processedAt: string;
  investmentId?: string;
}

type EmailRow = typeof processedEmails.$inferSelect;

function toAppModel(row: EmailRow): ProcessedEmail {
  return {
    emailId: row.emailId,
    processedAt: row.processedAt ?? new Date().toISOString(),
    investmentId: row.investmentId ?? undefined,
  };
}

export function findByUserId(userId: string): ProcessedEmail[] {
  return db.select().from(processedEmails).where(eq(processedEmails.userId, userId)).all().map(toAppModel);
}

export function isProcessed(userId: string, emailId: string): boolean {
  const [row] = db
    .select()
    .from(processedEmails)
    .where(and(eq(processedEmails.userId, userId), eq(processedEmails.emailId, emailId)))
    .limit(1)
    .all();
  return !!row;
}

export function markProcessed(userId: string, emailId: string, investmentId?: string): void {
  db.insert(processedEmails).values({ userId, emailId, investmentId: investmentId ?? null }).run();
}

export function bulkCreate(userId: string, items: ProcessedEmail[]): void {
  for (const item of items) {
    markProcessed(userId, item.emailId, item.investmentId);
  }
}
