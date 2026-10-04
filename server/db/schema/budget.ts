import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./index";

/**
 * A planned monthly or yearly money line: an expense (rent, electricity, school fees…)
 * or an income (salary, rent received…). Actual amounts are logged as budget_entries.
 */
export const budgetItems = sqliteTable(
  "budget_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("expense"), // expense | income
    name: text("name").notNull(),
    category: text("category").notNull().default("Other"), // Home | Utilities | … (expense) · Salary | Other income (income)
    costType: text("cost_type").notNull().default("fixed"), // fixed (pay once) | variable (spend against a cap)
    frequency: text("frequency").notNull().default("monthly"), // monthly | yearly
    amount: real("amount").notNull(), // planned INR per occurrence
    dueDay: integer("due_day"), // 1–31; null = any time in the month
    dueMonth: integer("due_month"), // 1–12, yearly items only
    paidFrom: text("paid_from"), // account label, e.g. "ICICI Bank ••4821"
    loanId: text("loan_id"), // EMI lines can point at the loan they repay
    notes: text("notes"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    userIdx: index("budget_items_user_idx").on(table.userId, table.kind),
  })
);

/** One payment / spend / receipt against a budget item, in the month it counts towards. */
export const budgetEntries = sqliteTable(
  "budget_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => budgetItems.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // yyyy-mm
    amount: real("amount").notNull(),
    date: text("date").notNull(), // yyyy-mm-dd
    note: text("note"),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    monthIdx: index("budget_entries_user_month_idx").on(table.userId, table.month),
  })
);
