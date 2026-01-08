import fs from "fs";
import path from "path";
import { Investment, Loan, Property, BankBalance, Transaction } from "@/core/types";
import { ZerodhaStock, ZerodhaMutualFund } from "@/core/services/zerodhaService";

const DATA_DIR = path.join(process.cwd(), "data");
const FILES = {
  investments: path.join(DATA_DIR, "investments.json"),
  loans: path.join(DATA_DIR, "loans.json"),
  properties: path.join(DATA_DIR, "properties.json"),
  bankBalances: path.join(DATA_DIR, "bankBalances.json"),
  transactions: path.join(DATA_DIR, "transactions.json"),
  stocks: path.join(DATA_DIR, "stocks.json"),
  mutualFunds: path.join(DATA_DIR, "mutualFunds.json"),
  portfolioCategories: path.join(DATA_DIR, "portfolioCategories.json"),
};

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`📁 Created data directory: ${DATA_DIR}`);
  }
}

// Initialize JSON files if they don't exist
function initializeFile(filePath: string) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), "utf-8");
      console.log(`📄 Initialized JSON file: ${filePath}`);
    }
  } catch (error) {
    console.warn(`Original warning: Failed to initialize file ${filePath}:`, error);
  }
}

// Initialize all data files
export function initializeStorage() {
  ensureDataDir();
  Object.values(FILES).forEach(initializeFile);
  console.log("✅ JSON storage initialized");
}

// Load data from JSON file
export function loadFromJson<T>(fileKey: keyof typeof FILES): T[] {
  try {
    ensureDataDir();
    const filePath = FILES[fileKey];
    initializeFile(filePath);

    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content || "[]");
    console.log(`📖 Loaded ${data.length} items from ${fileKey}`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`❌ Error loading ${fileKey}:`, error);
    return [];
  }
}

// Save data to JSON file
export function saveToJson<T>(fileKey: keyof typeof FILES, data: T[]): void {
  try {
    ensureDataDir();
    const filePath = FILES[fileKey];

    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonString, "utf-8");
    console.log(`💾 Saved ${data.length} items to ${fileKey} (${filePath})`);

    // Verify the save worked
    try {
      const verify = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(verify);
      if (parsed.length !== data.length) {
        console.error(`⚠️ Warning: Saved ${data.length} items but file contains ${parsed.length} items`);
      } else {
        console.log(`✅ Verified: File contains ${parsed.length} items`);
      }
    } catch (verifyError) {
      console.error(`⚠️ Could not verify save:`, verifyError);
    }
  } catch (error) {
    console.error(`❌ Error saving ${fileKey}:`, error);
    throw error;
  }
}

// Append data to JSON file (for adding new items)
export function appendToJson<T>(fileKey: keyof typeof FILES, newItems: T[]): void {
  try {
    const existing = loadFromJson<T>(fileKey);
    const updated = [...existing, ...newItems];
    saveToJson(fileKey, updated);
    console.log(`➕ Appended ${newItems.length} items to ${fileKey}`);
  } catch (error) {
    console.error(`❌ Error appending to ${fileKey}:`, error);
    throw error;
  }
}

// Update item in JSON file
export function updateInJson<T extends { id: string }>(
  fileKey: keyof typeof FILES,
  id: string,
  updates: Partial<T>
): T | null {
  try {
    const items = loadFromJson<T>(fileKey);
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      console.warn(`⚠️ Item with id ${id} not found in ${fileKey}`);
      return null;
    }

    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    saveToJson(fileKey, items);
    console.log(`✏️ Updated item ${id} in ${fileKey}`);
    return items[index];
  } catch (error) {
    console.error(`❌ Error updating ${fileKey}:`, error);
    throw error;
  }
}

// Delete item from JSON file
export function deleteFromJson<T extends { id: string }>(
  fileKey: keyof typeof FILES,
  id: string
): boolean {
  try {
    const items = loadFromJson<T>(fileKey);
    const filtered = items.filter((item) => item.id !== id);

    if (filtered.length === items.length) {
      console.warn(`⚠️ Item with id ${id} not found in ${fileKey}`);
      return false;
    }

    saveToJson(fileKey, filtered);
    console.log(`🗑️ Deleted item ${id} from ${fileKey}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting from ${fileKey}:`, error);
    throw error;
  }
}

// Load all portfolio data
export function loadAllPortfolioData() {
  return {
    investments: loadFromJson<Investment>("investments"),
    loans: loadFromJson<Loan>("loans"),
    properties: loadFromJson<Property>("properties"),
    bankBalances: loadFromJson<BankBalance>("bankBalances"),
    transactions: loadFromJson<Transaction>("transactions"),
  };
}

// Save all portfolio data
export function saveAllPortfolioData(data: {
  investments?: Investment[];
  loans?: Loan[];
  properties?: Property[];
  bankBalances?: BankBalance[];
  transactions?: Transaction[];
}) {
  ensureDataDir();
  if (data.investments !== undefined) {
    saveToJson("investments", data.investments);
    console.log(`💾 Saved ${data.investments.length} investments to JSON`);
  }
  if (data.loans !== undefined) {
    saveToJson("loans", data.loans);
    console.log(`💾 Saved ${data.loans.length} loans to JSON`);
  }
  if (data.properties !== undefined) {
    saveToJson("properties", data.properties);
    console.log(`💾 Saved ${data.properties.length} properties to JSON`);
  }
  if (data.bankBalances !== undefined) {
    saveToJson("bankBalances", data.bankBalances);
    console.log(`💾 Saved ${data.bankBalances.length} bank balances to JSON`);
  }
  if (data.transactions !== undefined) {
    saveToJson("transactions", data.transactions);
    console.log(`💾 Saved ${data.transactions.length} transactions to JSON`);
  }
  console.log("✅ All portfolio data saved to JSON files successfully");
}

// Save stocks data
export function saveStocks(stocks: ZerodhaStock[]): void {
  try {
    ensureDataDir();
    const filePath = FILES.stocks;
    const data = {
      stocks,
      lastUpdated: new Date().toISOString(),
    };
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonString, "utf-8");
    console.log(`💾 Saved ${stocks.length} stocks to JSON`);
  } catch (error) {
    console.error(`❌ Error saving stocks:`, error);
    throw error;
  }
}

// Load stocks data
export function loadStocks(): ZerodhaStock[] {
  try {
    ensureDataDir();
    const filePath = FILES.stocks;
    initializeFile(filePath);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content || "{}");
    
    // Handle both old format (array) and new format (object with stocks property)
    if (Array.isArray(data)) {
      return data;
    }
    return data.stocks || [];
  } catch (error) {
    console.error(`❌ Error loading stocks:`, error);
    return [];
  }
}

// Save mutual funds data
export function saveMutualFunds(mutualFunds: ZerodhaMutualFund[]): void {
  try {
    ensureDataDir();
    const filePath = FILES.mutualFunds;
    const data = {
      mutualFunds,
      lastUpdated: new Date().toISOString(),
    };
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonString, "utf-8");
    console.log(`💾 Saved ${mutualFunds.length} mutual funds to JSON`);
  } catch (error) {
    console.error(`❌ Error saving mutual funds:`, error);
    throw error;
  }
}

// Load mutual funds data
export function loadMutualFunds(): ZerodhaMutualFund[] {
  try {
    ensureDataDir();
    const filePath = FILES.mutualFunds;
    initializeFile(filePath);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content || "{}");
    
    // Handle both old format (array) and new format (object with mutualFunds property)
    if (Array.isArray(data)) {
      return data;
    }
    return data.mutualFunds || [];
  } catch (error) {
    console.error(`❌ Error loading mutual funds:`, error);
    return [];
  }
}

