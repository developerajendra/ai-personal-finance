import "server-only";
import { db } from "@/server/db/client";
import { chunk } from "./helpers";
import { stocks } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { ZerodhaStock } from "@/shared/types";

type StockRow = typeof stocks.$inferSelect;

function toAppModel(row: StockRow): ZerodhaStock {
  return {
    tradingsymbol: row.tradingsymbol,
    exchange: row.exchange,
    instrument_token: row.instrumentToken,
    quantity: row.quantity,
    average_price: row.averagePrice,
    last_price: row.lastPrice,
    pnl: row.pnl,
    pnl_percentage: row.pnlPercentage,
  };
}

export async function findByUserId(userId: string): Promise<ZerodhaStock[]> {
  const rows = await db.select().from(stocks).where(eq(stocks.userId, userId));
  return rows.map(toAppModel);
}

/**
 * Broker holdings are a point-in-time snapshot of the external account, so a
 * sync legitimately replaces the user's set. Runs in one transaction: readers
 * never observe an empty portfolio and a failed insert rolls back the delete.
 */
export async function replaceAll(userId: string, items: ZerodhaStock[]): Promise<void> {
  const now = new Date().toISOString();
  const rows = items.map((item) => ({
    userId,
    tradingsymbol: item.tradingsymbol,
    exchange: item.exchange,
    instrumentToken: item.instrument_token,
    quantity: item.quantity,
    averagePrice: item.average_price,
    lastPrice: item.last_price,
    pnl: item.pnl,
    pnlPercentage: item.pnl_percentage,
    lastUpdated: now,
  }));
  await db.transaction(async (tx) => {
    await tx.delete(stocks).where(eq(stocks.userId, userId));
    for (const part of chunk(rows)) await tx.insert(stocks).values(part);
  });
}
