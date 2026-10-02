export const CATEGORIES = {
  INCOME: ["salary", "interest", "dividends", "refunds", "other-income"],
  EXPENSES: [
    "food",
    "utilities",
    "shopping",
    "entertainment",
    "bills",
    "transport",
    "healthcare",
    "education",
    "other-expenses",
  ],
  INVESTMENTS: ["stocks", "mutual-funds", "fixed-deposits", "other-investments"],
  TRANSFERS: ["bank-transfer", "upi", "neft", "rtgs", "other-transfers"],
} as const;

export const TRANSACTION_TYPES = {
  DEBIT: "debit",
  CREDIT: "credit",
} as const;

export const DATA_SOURCES = {
  EXCEL: "excel",
  OCR: "ocr",
  KITE: "kite",
  GOOGLE_DRIVE: "google-drive",
} as const;

export const QUALITY_GRADES = {
  A: "A", // Complete and accurate
  B: "B", // Mostly complete
  C: "C", // Needs review
} as const;

