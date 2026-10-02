import "server-only";
import { db } from "@/server/db/client";
import { chunk } from "./helpers";
import { mutualFunds } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { ZerodhaMutualFund } from "@/shared/types";

type MFRow = typeof mutualFunds.$inferSelect;

function toAppModel(row: MFRow): ZerodhaMutualFund {
  return {
    tradingsymbol: row.tradingsymbol,
    fund_name: row.fundName,
    folio: row.folio,
    quantity: row.quantity,
    average_price: row.averagePrice,
    last_price: row.lastPrice,
    pnl: row.pnl,
    pnl_percentage: row.pnlPercentage,
  };
}

export async function findByUserId(userId: string): Promise<ZerodhaMutualFund[]> {
  const rows = await db.select().from(mutualFunds).where(eq(mutualFunds.userId, userId));
  return rows.map(toAppModel);
}

/**
 * Broker holdings are a point-in-time snapshot of the external account, so a
 * sync legitimately replaces the user's set. Runs in one transaction: readers
 * never observe an empty portfolio and a failed insert rolls back the delete.
 */
export async function replaceAll(userId: string, items: ZerodhaMutualFund[]): Promise<void> {
  const now = new Date().toISOString();
  const rows = items.map((item) => ({
    userId,
    tradingsymbol: item.tradingsymbol,
    fundName: item.fund_name,
    folio: item.folio,
    quantity: item.quantity,
    averagePrice: item.average_price,
    lastPrice: item.last_price,
    pnl: item.pnl,
    pnlPercentage: item.pnl_percentage,
    lastUpdated: now,
  }));
  await db.transaction(async (tx) => {
    await tx.delete(mutualFunds).where(eq(mutualFunds.userId, userId));
    for (const part of chunk(rows)) await tx.insert(mutualFunds).values(part);
  });
}
