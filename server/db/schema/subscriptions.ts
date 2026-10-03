import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./index";

/** Recurring services the user pays for (Netflix, ChatGPT, iCloud…). */
export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    plan: text("plan"),
    category: text("category").notNull().default("Other"), // AI tools | Entertainment | Cloud & storage | Other
    amount: real("amount").notNull(), // per billing cycle, in `currency`
    currency: text("currency").notNull().default("INR"), // INR | USD | NPR
    cycle: text("cycle").notNull().default("Monthly"), // Monthly | Yearly
    nextDate: text("next_date").notNull(), // yyyy-mm-dd: next renewal, or the end date when `ends`
    ends: integer("ends", { mode: "boolean" }).notNull().default(false), // true = won't renew after nextDate
    status: text("status").notNull().default("Active"), // Active | Cancelled
    paidWith: text("paid_with"),
    notes: text("notes"),
    remind: integer("remind", { mode: "boolean" }).notNull().default(true), // remind 3 days before nextDate
    color: text("color"),
    monogram: text("monogram"),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    userIdx: index("subscriptions_user_idx").on(table.userId, table.nextDate),
  })
);
