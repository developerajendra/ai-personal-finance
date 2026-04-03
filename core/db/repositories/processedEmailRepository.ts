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

export async function findByUserId(userId: string): Promise<ProcessedEmail[]> {
  const rows = await db.select().from(processedEmails).where(eq(processedEmails.userId, userId));
  return rows.map(toAppModel);
}

export async function isProcessed(userId: string, emailId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(processedEmails)
    .where(and(eq(processedEmails.userId, userId), eq(processedEmails.emailId, emailId)))
    .limit(1);
  const [row] = rows;
  return !!row;
}

export async function markProcessed(userId: string, emailId: string, investmentId?: string): Promise<void> {
  await db.insert(processedEmails).values({ userId, emailId, investmentId: investmentId ?? null });
}

export async function bulkCreate(userId: string, items: ProcessedEmail[]): Promise<void> {
  for (const item of items) {
    await markProcessed(userId, item.emailId, item.investmentId);
  }
}
