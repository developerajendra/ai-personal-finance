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

export function findByUserId(userId: string): ZerodhaStock[] {
  return db.select().from(stocks).where(eq(stocks.userId, userId)).all().map(toAppModel);
}

export function replaceAll(userId: string, items: ZerodhaStock[]): void {
  db.delete(stocks).where(eq(stocks.userId, userId)).run();
  const now = new Date().toISOString();
  for (const item of items) {
    db.insert(stocks)
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
      })
      .run();
  }
}
