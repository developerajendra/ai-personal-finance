import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

const CACHE_DIR = path.join(process.cwd(), ".cache", "excel-data");

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// Generate cache key from file name and content
export function generateCacheKey(filename: string, fileBuffer?: Buffer): string {
  if (fileBuffer) {
    // Use file content hash for more accurate caching
    const hash = createHash("md5").update(fileBuffer).digest("hex");
    return `${hash}.json`;
  }
  // Fallback to filename-based key
  const nameHash = createHash("md5").update(filename).digest("hex");
  return `${nameHash}.json`;
}

// Get cache file path
function getCacheFilePath(cacheKey: string): string {
  ensureCacheDir();
  return path.join(CACHE_DIR, cacheKey);
}

// Save parsed data to cache
export async function saveToCache(
  cacheKey: string,
  data: {
    parsedData: any[];
    portfolioItems: any;
    transactions: any[];
    metadata: {
      filename: string;
      uploadedAt: string;
      rowCount: number;
    };
  }
): Promise<void> {
  try {
    ensureCacheDir();
    const cachePath = getCacheFilePath(cacheKey);
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`✅ Cached data to: ${cachePath}`);
  } catch (error) {
    console.error("Error saving to cache:", error);
    // Don't throw - caching is optional
  }
}

// Load data from cache
export async function loadFromCache(cacheKey: string): Promise<{
  parsedData: any[];
  portfolioItems: any;
  transactions: any[];
  metadata: {
    filename: string;
    uploadedAt: string;
    rowCount: number;
  };
} | null> {
  try {
    const cachePath = getCacheFilePath(cacheKey);
    if (fs.existsSync(cachePath)) {
      const cachedData = fs.readFileSync(cachePath, "utf-8");
      const parsed = JSON.parse(cachedData);
      console.log(`✅ Loaded cached data from: ${cachePath}`);
      return parsed;
    }
    return null;
  } catch (error) {
    console.error("Error loading from cache:", error);
    return null;
  }
}

// Check if cache exists
export function cacheExists(cacheKey: string): boolean {
  const cachePath = getCacheFilePath(cacheKey);
  return fs.existsSync(cachePath);
}

// Clear old cache files (older than 30 days)
export function clearOldCache(maxAgeDays: number = 30): void {
  try {
    ensureCacheDir();
    const files = fs.readdirSync(CACHE_DIR);
    const now = Date.now();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

    files.forEach((file) => {
      const filePath = path.join(CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Cleared old cache: ${file}`);
      }
    });
  } catch (error) {
    console.error("Error clearing old cache:", error);
  }
}

