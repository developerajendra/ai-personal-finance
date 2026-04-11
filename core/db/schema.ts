import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

// ─── NextAuth tables ────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
  image: text("image"),
  hashedPassword: text("hashed_password"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    compoundKey: primaryKey({ columns: [table.provider, table.providerAccountId] }),
  })
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    compoundKey: primaryKey({ columns: [table.identifier, table.token] }),
  })
);

// ─── Financial data tables ──────────────────────────────────────────

export const investments = sqliteTable("investments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency"),
  originalAmount: real("original_amount"),
  originalCurrency: text("original_currency"),
  type: text("type").notNull(),
  assetType: text("asset_type"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  maturityDate: text("maturity_date"),
  maturityAmount: real("maturity_amount"),
  originalMaturityAmount: real("original_maturity_amount"),
  interestRate: real("interest_rate"),
  ruleLabel: text("rule_label"),
  ruleFormula: text("rule_formula"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const loans = sqliteTable("loans", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  principalAmount: real("principal_amount").notNull(),
  outstandingAmount: real("outstanding_amount").notNull(),
  interestRate: real("interest_rate").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  emiAmount: real("emi_amount").notNull(),
  emiDate: integer("emi_date").notNull(),
  tenureMonths: integer("tenure_months").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const properties = sqliteTable("properties", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  assetType: text("asset_type"),
  purchasePrice: real("purchase_price").notNull(),
  currentValue: real("current_value"),
  purchaseDate: text("purchase_date").notNull(),
  location: text("location").notNull(),
  description: text("description"),
  status: text("status").notNull().default("owned"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const bankBalances = sqliteTable("bank_balances", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number"),
  accountType: text("account_type").notNull(),
  assetType: text("asset_type"),
  balance: real("balance").notNull(),
  currency: text("currency").notNull().default("INR"),
  originalAmount: real("original_amount"),
  originalCurrency: text("original_currency"),
  lastUpdated: text("last_updated").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  issueDate: text("issue_date"),
  dueDate: text("due_date"),
  interestRate: real("interest_rate"),
  paidDate: text("paid_date"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(),
  frequency: text("frequency"),
  balance: real("balance"),
  account: text("account"),
  source: text("source").notNull(),
  qualityGrade: text("quality_grade"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const ppfAccounts = sqliteTable("ppf_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  memberId: text("member_id"),
  memberName: text("member_name"),
  establishmentId: text("establishment_id"),
  establishmentName: text("establishment_name"),
  depositEmployeeShare: real("deposit_employee_share").notNull().default(0),
  depositEmployerShare: real("deposit_employer_share").notNull().default(0),
  withdrawEmployeeShare: real("withdraw_employee_share").notNull().default(0),
  withdrawEmployerShare: real("withdraw_employer_share").notNull().default(0),
  pensionContribution: real("pension_contribution").notNull().default(0),
  grandTotal: real("grand_total").notNull().default(0),
  extractedFrom: text("extracted_from"),
  extractedAt: text("extracted_at").$defaultFn(() => new Date().toISOString()),
  lastUpdated: text("last_updated"),
  rawData: text("raw_data", { mode: "json" }),
});

export const loanSnapshots = sqliteTable("loan_snapshots", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  loanId: text("loan_id").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  outstandingAmount: real("outstanding_amount").notNull(),
  principalPaid: real("principal_paid").notNull(),
  interestPaid: real("interest_paid").notNull(),
  emiAmount: real("emi_amount").notNull(),
  interestRate: real("interest_rate").notNull(),
  remainingTenureMonths: integer("remaining_tenure_months").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const financialSnapshots = sqliteTable("financial_snapshots", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  month: integer("month"),
  period: text("period").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  totalInvestments: real("total_investments").notNull().default(0),
  totalLoans: real("total_loans").notNull().default(0),
  totalProperties: real("total_properties").notNull().default(0),
  totalBankBalances: real("total_bank_balances").notNull().default(0),
  totalReceivables: real("total_receivables").notNull().default(0),
  totalStocks: real("total_stocks").notNull().default(0),
  totalMutualFunds: real("total_mutual_funds").notNull().default(0),
  totalPPF: real("total_ppf").notNull().default(0),
  totalFixedAssets: real("total_fixed_assets").notNull().default(0),
  totalLiquidAssets: real("total_liquid_assets").notNull().default(0),
  netWorth: real("net_worth").notNull().default(0),
  totalIncome: real("total_income").notNull().default(0),
  totalExpenses: real("total_expenses").notNull().default(0),
  netBalance: real("net_balance").notNull().default(0),
  investmentBreakdown: text("investment_breakdown", { mode: "json" }).$type<Record<string, number>>(),
  loanBreakdown: text("loan_breakdown", { mode: "json" }).$type<Record<string, number>>(),
  propertyBreakdown: text("property_breakdown", { mode: "json" }).$type<Record<string, number>>(),
  categoryBreakdown: text("category_breakdown", { mode: "json" }).$type<Record<string, number>>(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const portfolioCategories = sqliteTable("portfolio_categories", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  icon: text("icon"),
  href: text("href").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const userConfigurations = sqliteTable("user_configurations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  configKey: text("config_key").notNull(),
  configValue: text("config_value").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const processedEmails = sqliteTable("processed_emails", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emailId: text("email_id").notNull(),
  processedAt: text("processed_at").$defaultFn(() => new Date().toISOString()),
  investmentId: text("investment_id"),
});

export const stocks = sqliteTable("stocks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tradingsymbol: text("tradingsymbol").notNull(),
  exchange: text("exchange").notNull(),
  instrumentToken: text("instrument_token").notNull(),
  quantity: integer("quantity").notNull(),
  averagePrice: real("average_price").notNull(),
  lastPrice: real("last_price").notNull(),
  pnl: real("pnl").notNull(),
  pnlPercentage: real("pnl_percentage").notNull(),
  lastUpdated: text("last_updated").$defaultFn(() => new Date().toISOString()),
});

export const mutualFunds = sqliteTable("mutual_funds", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tradingsymbol: text("tradingsymbol").notNull(),
  fundName: text("fund_name").notNull(),
  folio: text("folio").notNull(),
  quantity: real("quantity").notNull(),
  averagePrice: real("average_price").notNull(),
  lastPrice: real("last_price").notNull(),
  pnl: real("pnl").notNull(),
  pnlPercentage: real("pnl_percentage").notNull(),
  lastUpdated: text("last_updated").$defaultFn(() => new Date().toISOString()),
});
