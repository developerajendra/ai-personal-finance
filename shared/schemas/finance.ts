import { z } from "zod";
import { toMoney } from "@/shared/utils/money";

/**
 * Validation for financial writes. Shared by API routes, imports, agents and
 * AI tools so every entry point enforces the same rules. Zod strips unknown
 * keys, which keeps ownership fields such as `userId` out of writes.
 */

const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const toNumber = (v: unknown) => {
  const value = blankToUndefined(v);
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    return Number.isNaN(n) ? value : n;
  }
  return value;
};

export const moneySchema = z.preprocess(toNumber, z.number().finite()).transform(toMoney);
export const positiveMoneySchema = z
  .preprocess(toNumber, z.number().finite().positive("Amount must be greater than 0"))
  .transform(toMoney);
/** Non-negative amount; direction is carried by a separate type field. */
export const nonNegativeMoneySchema = z
  .preprocess(toNumber, z.number().finite().min(0, "Amount cannot be negative"))
  .transform(toMoney);
export const optionalMoneySchema = z
  .preprocess(toNumber, z.number().finite().optional())
  .transform((v) => (v === undefined ? undefined : toMoney(v)));
const optionalNumber = z.preprocess(toNumber, z.number().finite().optional());
const optionalString = (max = 2000) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

/** Accepts YYYY-MM-DD or a full ISO timestamp; rejects unparseable strings. */
export const dateStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "Invalid date");
const optionalDate = z.preprocess(blankToUndefined, dateStringSchema.optional());

/** Client-supplied ids are accepted when safe (existing forms generate them). */
export const recordIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.:-]+$/, "Invalid id");

const tagsSchema = z.preprocess(blankToUndefined, z.array(z.string().trim().max(100)).max(50).optional());

export const INVESTMENT_TYPES = ["ppf", "epf", "nps", "retirement-other", "fd", "mutual-fund", "stocks", "bonds", "other"] as const;
/**
 * Investment types that roll up into the Retirement asset class, alongside EPFO passbook
 * accounts. PPF is deliberately not here: it is tracked as a regular investment.
 */
export const RETIREMENT_INVESTMENT_TYPES = ["nps", "epf", "retirement-other"] as const;
export const INVESTMENT_STATUSES = ["active", "matured", "closed"] as const;
export const ASSET_TYPES = ["fixed", "liquid"] as const;

export const investmentInputSchema = z.object({
  id: recordIdSchema.optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  amount: moneySchema,
  currency: optionalString(8),
  originalAmount: optionalMoneySchema,
  originalCurrency: optionalString(8),
  type: z.enum(INVESTMENT_TYPES),
  assetType: z.preprocess(blankToUndefined, z.enum(ASSET_TYPES).optional()),
  startDate: dateStringSchema,
  endDate: optionalDate,
  maturityDate: optionalDate,
  maturityAmount: optionalMoneySchema,
  originalMaturityAmount: optionalMoneySchema,
  interestRate: optionalNumber,
  ruleLabel: optionalString(200),
  ruleFormula: optionalString(1000),
  description: optionalString(),
  status: z.enum(INVESTMENT_STATUSES).default("active"),
  isPublished: z.boolean().optional(),
  tags: tagsSchema,
});
export const investmentUpdateSchema = investmentInputSchema.omit({ id: true }).partial();
export type InvestmentInput = z.input<typeof investmentInputSchema>;
export type InvestmentUpdate = z.input<typeof investmentUpdateSchema>;

export const LOAN_TYPES = ["home-loan", "car-loan", "personal-loan", "education-loan", "other"] as const;
export const LOAN_STATUSES = ["active", "closed", "foreclosed"] as const;

export const loanInputSchema = z.object({
  id: recordIdSchema.optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  type: z.enum(LOAN_TYPES),
  principalAmount: moneySchema,
  outstandingAmount: moneySchema,
  interestRate: z.preprocess(toNumber, z.number().finite()),
  startDate: dateStringSchema,
  endDate: optionalDate,
  emiAmount: moneySchema,
  emiDate: z.preprocess(toNumber, z.number().int().min(1).max(31)),
  tenureMonths: z.preprocess(toNumber, z.number().int().min(0)),
  description: optionalString(),
  status: z.enum(LOAN_STATUSES).default("active"),
  isPublished: z.boolean().optional(),
});
export const loanUpdateSchema = loanInputSchema.omit({ id: true }).partial();
export type LoanInput = z.input<typeof loanInputSchema>;
export type LoanUpdate = z.input<typeof loanUpdateSchema>;

export const PROPERTY_TYPES = ["house", "plot", "apartment", "commercial", "land", "other"] as const;
export const PROPERTY_STATUSES = ["owned", "rented-out", "under-construction"] as const;

export const propertyInputSchema = z.object({
  id: recordIdSchema.optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  type: z.enum(PROPERTY_TYPES),
  assetType: z.preprocess(blankToUndefined, z.enum(ASSET_TYPES).optional()),
  purchasePrice: moneySchema,
  currentValue: optionalMoneySchema,
  purchaseDate: dateStringSchema,
  location: z.string().trim().max(500).default(""),
  description: optionalString(),
  status: z.enum(PROPERTY_STATUSES).default("owned"),
  isPublished: z.boolean().optional(),
});
export const propertyUpdateSchema = propertyInputSchema.omit({ id: true }).partial();
export type PropertyInput = z.input<typeof propertyInputSchema>;
export type PropertyUpdate = z.input<typeof propertyUpdateSchema>;

export const BANK_ACCOUNT_TYPES = ["savings", "current", "salary", "fd", "rd", "other"] as const;
export const BANK_ACCOUNT_STATUSES = ["active", "closed", "dormant"] as const;

export const bankBalanceInputSchema = z.object({
  id: recordIdSchema.optional(),
  bankName: z.string().trim().min(1, "Bank name is required").max(200),
  accountNumber: optionalString(64),
  accountType: z.enum(BANK_ACCOUNT_TYPES),
  assetType: z.preprocess(blankToUndefined, z.enum(ASSET_TYPES).optional()),
  balance: moneySchema,
  currency: z.string().trim().max(8).default("INR"),
  originalAmount: optionalMoneySchema,
  originalCurrency: optionalString(8),
  lastUpdated: z.preprocess(blankToUndefined, dateStringSchema.optional()),
  description: optionalString(),
  status: z.enum(BANK_ACCOUNT_STATUSES).default("active"),
  isPublished: z.boolean().optional(),
  issueDate: optionalDate,
  dueDate: optionalDate,
  interestRate: optionalNumber,
  paidDate: optionalDate,
  settledAmount: optionalMoneySchema,
  tags: tagsSchema,
});
export const bankBalanceUpdateSchema = bankBalanceInputSchema.omit({ id: true }).partial();
export type BankBalanceInput = z.input<typeof bankBalanceInputSchema>;
export type BankBalanceUpdate = z.input<typeof bankBalanceUpdateSchema>;

export const TRANSACTION_TYPES = ["debit", "credit"] as const;
export const TRANSACTION_SOURCES = ["excel", "ocr", "kite", "google-drive", "manual", "chat", "whatsapp"] as const;

export const transactionInputSchema = z.object({
  id: recordIdSchema.optional(),
  date: dateStringSchema,
  // Imported statements can contain zero-value rows; conversational entry
  // points require a positive amount in their own tool schemas.
  amount: nonNegativeMoneySchema,
  description: z.string().trim().min(1, "Description is required").max(1000),
  category: z.string().trim().min(1).max(100).default("uncategorized"),
  type: z.enum(TRANSACTION_TYPES),
  balance: optionalMoneySchema,
  account: optionalString(200),
  source: z.enum(TRANSACTION_SOURCES).default("manual"),
  qualityGrade: z.preprocess(blankToUndefined, z.enum(["A", "B", "C"]).optional()),
});
export const transactionUpdateSchema = transactionInputSchema.omit({ id: true, source: true }).partial();
export type TransactionInput = z.input<typeof transactionInputSchema>;
export type TransactionUpdate = z.input<typeof transactionUpdateSchema>;

export const PORTFOLIO_CATEGORY_TYPES = ["investment", "loan", "property", "bank-balance"] as const;

export const portfolioCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100),
  icon: optionalString(64),
  href: z.string().trim().min(1).max(300),
  type: z.enum(PORTFOLIO_CATEGORY_TYPES),
  description: optionalString(),
});
export const portfolioCategoryUpdateSchema = portfolioCategoryInputSchema.partial();

export const SUBSCRIPTION_CATEGORIES = ["AI tools", "Entertainment", "Cloud & storage", "Other"] as const;
export const SUBSCRIPTION_CURRENCIES = ["INR", "USD", "NPR"] as const;
export const SUBSCRIPTION_CYCLES = ["Monthly", "Yearly"] as const;
export const SUBSCRIPTION_STATUSES = ["Active", "Cancelled"] as const;

export const subscriptionInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  plan: optionalString(120),
  category: z.enum(SUBSCRIPTION_CATEGORIES).default("Other"),
  amount: z.preprocess(toNumber, z.number().finite().gt(0, "Enter an amount above 0.")).transform(toMoney),
  currency: z.enum(SUBSCRIPTION_CURRENCIES).default("INR"),
  cycle: z.enum(SUBSCRIPTION_CYCLES).default("Monthly"),
  nextDate: dateStringSchema,
  ends: z.boolean().default(false),
  status: z.enum(SUBSCRIPTION_STATUSES).default("Active"),
  paidWith: optionalString(120),
  notes: optionalString(1000),
  remind: z.boolean().default(true),
  color: optionalString(32),
  monogram: optionalString(4),
});
export const subscriptionUpdateSchema = subscriptionInputSchema.partial();
export type SubscriptionInput = z.input<typeof subscriptionInputSchema>;
