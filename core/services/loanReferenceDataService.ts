import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const LOANS_DIR = path.join(DATA_DIR, "loans");
const REFERENCE_DATA_FILE = path.join(LOANS_DIR, "loanReferenceData.json");
const OLD_REFERENCE_DATA_FILE = path.join(DATA_DIR, "loanReferenceData.json");

export interface LoanReferenceData {
  data: Record<string, string | number>; // Key-value pairs like { "Disbursement Amount": 2311386 }
  createdAt: string;
  updatedAt: string;
}

interface LoanReferenceDataStore {
  global: LoanReferenceData;
}

// Ensure reference data file exists
function ensureReferenceDataFile() {
  // Create loans directory if it doesn't exist
  if (!fs.existsSync(LOANS_DIR)) {
    fs.mkdirSync(LOANS_DIR, { recursive: true });
  }
  
  // Migrate old file if it exists (from old location)
  if (fs.existsSync(OLD_REFERENCE_DATA_FILE) && !fs.existsSync(REFERENCE_DATA_FILE)) {
    try {
      // Read old file and migrate format
      const oldContent = fs.readFileSync(OLD_REFERENCE_DATA_FILE, "utf-8");
      const oldData = JSON.parse(oldContent);
      
      // Convert old format to new format
      let migratedData: LoanReferenceDataStore;
      if (oldData.loans && !oldData.global) {
        // Old format - migrate to global
        const allData: Record<string, string | number> = {};
        Object.values(oldData.loans).forEach((loan: any) => {
          if (loan.data) {
            Object.assign(allData, loan.data);
          }
        });
        migratedData = {
          global: {
            data: allData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
      } else {
        // Already in new format or empty
        migratedData = oldData.global ? oldData : {
          global: {
            data: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
      }
      
      fs.writeFileSync(REFERENCE_DATA_FILE, JSON.stringify(migratedData, null, 2), "utf-8");
      console.log('[Loan Reference Data] Migrated and converted loanReferenceData.json to data/loans/');
    } catch (error) {
      console.error('[Loan Reference Data] Error migrating file:', error);
    }
  }
  
  // Also check if new location file exists but is in old format
  if (fs.existsSync(REFERENCE_DATA_FILE)) {
    try {
      const content = fs.readFileSync(REFERENCE_DATA_FILE, "utf-8");
      const data = JSON.parse(content);
      if (data.loans && !data.global) {
        // File exists but is in old format - convert it
        const allData: Record<string, string | number> = {};
        Object.values(data.loans).forEach((loan: any) => {
          if (loan.data) {
            Object.assign(allData, loan.data);
          }
        });
        const migratedData: LoanReferenceDataStore = {
          global: {
            data: allData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
        fs.writeFileSync(REFERENCE_DATA_FILE, JSON.stringify(migratedData, null, 2), "utf-8");
        console.log('[Loan Reference Data] Converted existing file from old format to new format');
      }
    } catch (error) {
      console.error('[Loan Reference Data] Error checking file format:', error);
    }
  }
  
  if (!fs.existsSync(REFERENCE_DATA_FILE)) {
    const store: LoanReferenceDataStore = {
      global: {
        data: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    fs.writeFileSync(REFERENCE_DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
  }
}

// Load reference data store
function loadReferenceDataStore(): LoanReferenceDataStore {
  try {
    ensureReferenceDataFile();
    const content = fs.readFileSync(REFERENCE_DATA_FILE, "utf-8");
    const data = JSON.parse(content || '{"global":{"data":{},"createdAt":"","updatedAt":""}}');
    let needsSave = false;
    
    // Migrate old format if needed
    if (data.loans && !data.global) {
      // Old format - migrate to global
      const allData: Record<string, string | number> = {};
      Object.values(data.loans).forEach((loan: any) => {
        if (loan.data) {
          Object.assign(allData, loan.data);
        }
      });
      data.global = {
        data: allData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      delete data.loans;
      needsSave = true;
      console.log('[Loan Reference Data] Migrated from old format to global format');
    }
    
    if (!data.global) {
      data.global = {
        data: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      needsSave = true;
    }
    
    // Save migrated data back to file
    if (needsSave) {
      saveReferenceDataStore(data);
    }
    
    return data;
  } catch (error) {
    console.error("❌ Error loading loan reference data:", error);
    return {
      global: {
        data: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }
}

// Save reference data store
function saveReferenceDataStore(store: LoanReferenceDataStore): void {
  try {
    ensureReferenceDataFile();
    const jsonString = JSON.stringify(store, null, 2);
    fs.writeFileSync(REFERENCE_DATA_FILE, jsonString, "utf-8");
  } catch (error) {
    console.error("❌ Error saving loan reference data:", error);
    throw error;
  }
}

// Get global reference data
export function getGlobalReferenceData(): LoanReferenceData {
  const store = loadReferenceDataStore();
  return store.global;
}

// Update a specific key-value pair in reference data
export function updateReferenceDataKey(
  key: string,
  value: string | number
): LoanReferenceData {
  const store = loadReferenceDataStore();
  const existing = store.global || {
    data: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  existing.data[key] = value;
  existing.updatedAt = new Date().toISOString();

  store.global = existing;
  saveReferenceDataStore(store);
  return existing;
}

// Delete a key from reference data
export function deleteReferenceDataKey(key: string): LoanReferenceData {
  const store = loadReferenceDataStore();
  const existing = store.global || {
    data: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  delete existing.data[key];
  existing.updatedAt = new Date().toISOString();

  store.global = existing;
  saveReferenceDataStore(store);
  return existing;
}

// Set all reference data at once
export function setGlobalReferenceData(data: Record<string, string | number>): LoanReferenceData {
  const store = loadReferenceDataStore();
  const existing = store.global || {
    data: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  existing.data = data;
  existing.updatedAt = new Date().toISOString();

  store.global = existing;
  saveReferenceDataStore(store);
  return existing;
}
