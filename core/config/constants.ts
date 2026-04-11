export const CATEGORIES = {
  INCOME: ["salary", "interest", "dividends", "refunds", "other-income"],
  EXPENSES: [
    // Household Bills
    "water-bills",
    "electricity",
    "phone-bills",
    "internet",
    "gas-lpg",
    "rent",
    // Loans & EMI
    "car-loan",
    "home-loan",
    "personal-loan",
    "installment",
    // Healthcare
    "medicine",
    "doctor-visit",
    "health-insurance",
    // Household Services
    "household-staff",
    "car-washer",
    "maintenance-repair",
    // Transport
    "transport",
    "fuel-petrol",
    "parking",
    // Food & Dining
    "food",
    "groceries",
    "dining-out",
    // Shopping
    "shopping",
    "clothing",
    // Subscriptions
    "ott-streaming",
    "gym-fitness",
    "subscriptions",
    // Education
    "education",
    "school-fees",
    // Other
    "utilities",
    "entertainment",
    "bills",
    "other-expenses",
  ],
  INVESTMENTS: ["stocks", "mutual-funds", "fixed-deposits", "other-investments"],
  TRANSFERS: ["bank-transfer", "upi", "neft", "rtgs", "other-transfers"],
} as const;

export const EXPENSE_GROUPS: Record<string, string[]> = {
  "Household Bills":    ["water-bills", "electricity", "phone-bills", "internet", "gas-lpg", "rent"],
  "Loans & EMI":        ["car-loan", "home-loan", "personal-loan", "installment"],
  "Healthcare":         ["medicine", "doctor-visit", "health-insurance"],
  "Household Services": ["household-staff", "car-washer", "maintenance-repair"],
  "Transport":          ["transport", "fuel-petrol", "parking"],
  "Food & Dining":      ["food", "groceries", "dining-out"],
  "Shopping":           ["shopping", "clothing"],
  "Subscriptions":      ["ott-streaming", "gym-fitness", "subscriptions"],
  "Education":          ["education", "school-fees"],
  "Other":              ["utilities", "entertainment", "bills", "other-expenses"],
};

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

