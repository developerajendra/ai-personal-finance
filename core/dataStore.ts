import { Investment, Loan, Property, Transaction, BankBalance } from "@/core/types";

// Shared in-memory storage
// In a real production app, this would be a database connection

export const investments: Investment[] = [];
export const loans: Loan[] = [];
export const properties: Property[] = [];
export const bankBalances: BankBalance[] = [];
export const transactions: Transaction[] = []; // Adding transactions here too if needed, though not strictly requested yet
