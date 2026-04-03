import { db } from "@/core/db";
import { mutualFunds } from "@/core/db/schema";
import { eq } from "drizzle-orm";
import type { ZerodhaMutualFund } from "@/core/services/zerodhaService";

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

export function findByUserId(userId: string): ZerodhaMutualFund[] {
  return db.select().from(mutualFunds).where(eq(mutualFunds.userId, userId)).all().map(toAppModel);
}

export function replaceAll(userId: string, items: ZerodhaMutualFund[]): void {
  db.delete(mutualFunds).where(eq(mutualFunds.userId, userId)).run();
  const now = new Date().toISOString();
  for (const item of items) {
    db.insert(mutualFunds)
      .values({
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
      })
      .run();
  }
}
