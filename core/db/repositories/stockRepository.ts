import { db } from "@/core/db";
import { stocks } from "@/core/db/schema";
import { eq } from "drizzle-orm";
import type { ZerodhaStock } from "@/core/services/zerodhaService";

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

export async function replaceAll(userId: string, items: ZerodhaStock[]): Promise<void> {
  await db.delete(stocks).where(eq(stocks.userId, userId));
  const now = new Date().toISOString();
  for (const item of items) {
    await db.insert(stocks)
      .values({
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
      });
  }
}
