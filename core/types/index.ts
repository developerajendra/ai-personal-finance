export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  type: "debit" | "credit";
  balance?: number;
  account?: string;
  source: "excel" | "ocr" | "kite" | "google-drive";
  qualityGrade?: "A" | "B" | "C";
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense" | "investment" | "transfer";
  color?: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  categoryBreakdown: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  charts?: ChartData[];
  tables?: TableData[];
}

export interface ChartData {
  type: "bar" | "line" | "pie" | "area";
  data: any[];
  options?: any;
}

export interface TableData {
  headers: string[];
  rows: any[][];
}

export interface FileUpload {
  id: string;
  filename: string;
  type: "excel" | "pdf" | "image";
  status: "uploading" | "processing" | "completed" | "error";
  progress?: number;
  error?: string;
  data?: Transaction[];
}

export interface Investment {
  id: string;
  name: string; // e.g., "PPF", "FD", "Mutual Fund"
  amount: number;
  type: "ppf" | "fd" | "mutual-fund" | "stocks" | "bonds" | "other";
  startDate: string;
  endDate?: string; // Optional
  maturityDate?: string; // Optional
  interestRate?: number;
  description?: string;
  status: "active" | "matured" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  name: string; // e.g., "House Loan", "Car Loan"
  type: "home-loan" | "car-loan" | "personal-loan" | "education-loan" | "other";
  principalAmount: number;
  outstandingAmount: number;
  interestRate: number;
  startDate: string;
  endDate?: string; // Loan tenure end date
  emiAmount: number;
  emiDate: number; // Day of month
  tenureMonths: number;
  description?: string;
  status: "active" | "closed" | "foreclosed";
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  name: string; // e.g., "House", "Plot", "Commercial Property"
  type: "house" | "plot" | "apartment" | "commercial" | "land" | "other";
  purchasePrice: number;
  currentValue?: number;
  purchaseDate: string;
  location: string;
  description?: string;
  status: "owned" | "rented-out" | "under-construction";
  createdAt: string;
  updatedAt: string;
}

export interface BankBalance {
  id: string;
  bankName: string; // e.g., "HDFC Bank", "SBI", "ICICI Bank"
  accountNumber?: string; // Optional for privacy
  accountType: "savings" | "current" | "salary" | "fd" | "rd" | "other";
  balance: number; // Current balance
  currency: string; // Default: "INR"
  lastUpdated: string; // ISO date string
  description?: string;
  status: "active" | "closed" | "dormant";
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioSummary {
  totalInvestments: number;
  totalLoans: number;
  totalProperties: number;
  netWorth: number; // Investments + Properties - Loans
  investmentBreakdown: Record<string, number>;
  loanBreakdown: Record<string, number>;
  propertyBreakdown: Record<string, number>;
}

export interface DynamicCategory {
  id: string;
  name: string;
  type: "investment" | "loan" | "property" | "expense" | "income";
  subcategories?: string[];
  description?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryLearning {
  id: string;
  pattern: string; // Text pattern to match
  category: string; // Category name
  confidence: number; // 0-1
  usageCount: number;
  successRate: number; // 0-1
  createdAt: string;
  lastUsed: string;
}

