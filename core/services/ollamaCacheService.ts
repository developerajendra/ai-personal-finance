import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

const CACHE_DIR = path.join(process.cwd(), ".cache", "ollama-responses");
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const FUZZY_MATCH_THRESHOLD = parseFloat(
  process.env.OLLAMA_CACHE_FUZZY_THRESHOLD || "0.85"
); // 85% similarity threshold for fuzzy matching
const MIN_QUERY_LENGTH = parseInt(
  process.env.OLLAMA_CACHE_MIN_QUERY_LENGTH || "10",
  10
); // Minimum query length for fuzzy matching
const FUZZY_MATCH_ENABLED =
  process.env.OLLAMA_CACHE_FUZZY_ENABLED !== "false"; // Enabled by default

interface CachedResponse {
  id: string;
  queryHash: string;
  message: string;
  systemPrompt?: string;
  response: string;
  metadata: {
    timestamp: number;
    model: string;
    queryType: "chat" | "content" | "json";
    responseTime: number; // Time taken to generate (ms)
  };
  usage: {
    hitCount: number;
    lastAccessed: number;
  };
}

// Ensure cache directory exists
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// In-memory index for fuzzy matching — avoids reading all cache files on every lookup
interface CacheIndexEntry {
  queryHash: string;
  normalizedMessage: string;
  normalizedSystemPrompt: string;
  timestamp: number;
}
let cacheIndex: Map<string, CacheIndexEntry> | null = null;

function getOrBuildIndex(): Map<string, CacheIndexEntry> {
  if (cacheIndex !== null) return cacheIndex;
  cacheIndex = new Map();
  if (!fs.existsSync(CACHE_DIR)) return cacheIndex;
  try {
    const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const data: CachedResponse = JSON.parse(
          fs.readFileSync(path.join(CACHE_DIR, file), "utf-8")
        );
        cacheIndex.set(data.queryHash, {
          queryHash: data.queryHash,
          normalizedMessage: normalizeText(data.message),
          normalizedSystemPrompt: data.systemPrompt ? normalizeText(data.systemPrompt) : "",
          timestamp: data.metadata.timestamp,
        });
      } catch {
        // skip corrupted entries
      }
    }
  } catch {
    // skip if dir unreadable
  }
  return cacheIndex;
}

function addToIndex(cached: CachedResponse): void {
  const index = getOrBuildIndex();
  index.set(cached.queryHash, {
    queryHash: cached.queryHash,
    normalizedMessage: normalizeText(cached.message),
    normalizedSystemPrompt: cached.systemPrompt ? normalizeText(cached.systemPrompt) : "",
    timestamp: cached.metadata.timestamp,
  });
}

function removeFromIndex(queryHash: string): void {
  cacheIndex?.delete(queryHash);
}

/**
 * Normalize text for comparison (lowercase, remove extra spaces, punctuation)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeText(str1);
  const normalized2 = normalizeText(str2);

  // If normalized strings are identical, return 1.0
  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  if (maxLength === 0) {
    return 1.0;
  }

  // Similarity = 1 - (distance / maxLength)
  return 1 - distance / maxLength;
}

/**
 * Generate a cache key from message and system prompt
 */
export function generateCacheKey(
  message: string,
  systemPrompt?: string
): string {
  const combined = systemPrompt
    ? `${systemPrompt}\n\n${message}`
    : message;
  const hash = createHash("md5").update(combined.trim()).digest("hex");
  return hash;
}

/**
 * Get cache file path
 */
function getCacheFilePath(cacheKey: string): string {
  ensureCacheDir();
  return path.join(CACHE_DIR, `${cacheKey}.json`);
}

/**
 * Save response to cache
 */
export async function saveToCache(
  message: string,
  systemPrompt: string | undefined,
  response: string,
  options: {
    model: string;
    queryType: "chat" | "content" | "json";
    responseTime: number;
    ttl?: number; // Time to live in milliseconds
  }
): Promise<void> {
  try {
    ensureCacheDir();
    const cacheKey = generateCacheKey(message, systemPrompt);
    const cachePath = getCacheFilePath(cacheKey);

    const cachedResponse: CachedResponse = {
      id: `${Date.now()}-${cacheKey.substring(0, 8)}`,
      queryHash: cacheKey,
      message,
      systemPrompt,
      response,
      metadata: {
        timestamp: Date.now(),
        model: options.model,
        queryType: options.queryType,
        responseTime: options.responseTime,
      },
      usage: {
        hitCount: 0,
        lastAccessed: Date.now(),
      },
    };

    fs.writeFileSync(cachePath, JSON.stringify(cachedResponse, null, 2), "utf-8");
    addToIndex(cachedResponse);
    console.log(`[Ollama Cache] ✅ Cached response: ${cacheKey.substring(0, 12)}...`);
  } catch (error) {
    console.error("[Ollama Cache] Error saving to cache:", error);
    // Don't throw - caching is optional
  }
}

/**
 * Find similar cached responses using fuzzy matching.
 * Uses an in-memory index to avoid reading all cache files on every call.
 */
async function findSimilarCachedResponses(
  message: string,
  systemPrompt: string | undefined,
  ttl: number = DEFAULT_TTL,
  threshold: number = FUZZY_MATCH_THRESHOLD
): Promise<Array<{ cached: CachedResponse; similarity: number }>> {
  const similar: Array<{ cached: CachedResponse; similarity: number }> = [];
  const normalizedQuery = normalizeText(message);
  const normalizedSystemPrompt = systemPrompt ? normalizeText(systemPrompt) : "";
  const now = Date.now();

  if (normalizedQuery.length < MIN_QUERY_LENGTH) {
    return similar;
  }

  try {
    const index = getOrBuildIndex();

    for (const entry of index.values()) {
      // Skip expired entries
      if (now - entry.timestamp > ttl) continue;

      // System prompt must match
      const systemPromptMatch =
        (!systemPrompt && !entry.normalizedSystemPrompt) ||
        (systemPrompt && entry.normalizedSystemPrompt === normalizedSystemPrompt);
      if (!systemPromptMatch) continue;

      // Length-ratio pre-filter: if lengths are too different, similarity can't reach threshold
      const lenA = normalizedQuery.length;
      const lenB = entry.normalizedMessage.length;
      const maxLen = Math.max(lenA, lenB);
      if (maxLen > 0 && Math.abs(lenA - lenB) / maxLen > 1 - threshold) continue;

      // Run Levenshtein only for entries that pass the pre-filter
      const distance = levenshteinDistance(normalizedQuery, entry.normalizedMessage);
      const similarity = maxLen === 0 ? 1.0 : 1 - distance / maxLen;

      if (similarity >= threshold) {
        // Load the full cache file only for matching entries
        try {
          const filePath = path.join(CACHE_DIR, `${entry.queryHash}.json`);
          const cached: CachedResponse = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          similar.push({ cached, similarity });
        } catch {
          removeFromIndex(entry.queryHash);
        }
      }
    }

    similar.sort((a, b) => b.similarity - a.similarity);
    return similar;
  } catch (error) {
    console.error("[Ollama Cache] Error finding similar cached responses:", error);
    return similar;
  }
}

/**
 * Load response from cache (exact match first, then fuzzy match)
 */
export async function loadFromCache(
  message: string,
  systemPrompt?: string,
  ttl: number = DEFAULT_TTL,
  options?: { enableFuzzyMatch?: boolean; fuzzyThreshold?: number }
): Promise<CachedResponse | null> {
  const enableFuzzyMatch =
    FUZZY_MATCH_ENABLED && (options?.enableFuzzyMatch !== false); // Enabled by default
  const fuzzyThreshold = options?.fuzzyThreshold || FUZZY_MATCH_THRESHOLD;

  try {
    // First, try exact match
    const cacheKey = generateCacheKey(message, systemPrompt);
    const cachePath = getCacheFilePath(cacheKey);

    if (fs.existsSync(cachePath)) {
      const cachedData = fs.readFileSync(cachePath, "utf-8");
      const cached: CachedResponse = JSON.parse(cachedData);

      // Check if cache is expired
      const age = Date.now() - cached.metadata.timestamp;
      if (age > ttl) {
        console.log(
          `[Ollama Cache] ⏰ Cache expired for: ${cacheKey.substring(0, 12)}... (age: ${Math.round(age / 1000 / 60)} minutes)`
        );
        // Delete expired cache
        fs.unlinkSync(cachePath);
      } else {
        // Update usage stats
        cached.usage.hitCount++;
        cached.usage.lastAccessed = Date.now();
        fs.writeFileSync(cachePath, JSON.stringify(cached, null, 2), "utf-8");

        console.log(
          `[Ollama Cache] ✅ Cache HIT (exact): ${cacheKey.substring(0, 12)}... (saved ${Math.round(age / 1000)}s ago, ${cached.usage.hitCount} hits)`
        );

        return cached;
      }
    }

    // If exact match not found and fuzzy matching is enabled, try fuzzy match
    if (enableFuzzyMatch) {
      const similar = await findSimilarCachedResponses(
        message,
        systemPrompt,
        ttl,
        fuzzyThreshold
      );

      if (similar.length > 0) {
        const bestMatch = similar[0];
        const { cached, similarity } = bestMatch;

        // Update usage stats for the matched cache
        cached.usage.hitCount++;
        cached.usage.lastAccessed = Date.now();
        const matchedCachePath = getCacheFilePath(cached.queryHash);
        fs.writeFileSync(
          matchedCachePath,
          JSON.stringify(cached, null, 2),
          "utf-8"
        );

        console.log(
          `[Ollama Cache] ✅ Cache HIT (fuzzy): ${(similarity * 100).toFixed(1)}% similar to "${cached.message.substring(0, 50)}..." (${cached.usage.hitCount} hits)`
        );

        return cached;
      }
    }

    return null;
  } catch (error) {
    console.error("[Ollama Cache] Error loading from cache:", error);
    return null;
  }
}

/**
 * Check if cache exists (without loading)
 */
export function cacheExists(
  message: string,
  systemPrompt?: string
): boolean {
  try {
    const cacheKey = generateCacheKey(message, systemPrompt);
    const cachePath = getCacheFilePath(cacheKey);
    return fs.existsSync(cachePath);
  } catch (error) {
    return false;
  }
}

/**
 * Invalidate cache for a specific query
 */
export function invalidateCache(
  message: string,
  systemPrompt?: string
): boolean {
  try {
    const cacheKey = generateCacheKey(message, systemPrompt);
    const cachePath = getCacheFilePath(cacheKey);

    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
      removeFromIndex(cacheKey);
      console.log(`[Ollama Cache] 🗑️  Invalidated cache: ${cacheKey.substring(0, 12)}...`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("[Ollama Cache] Error invalidating cache:", error);
    return false;
  }
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache(maxAge: number = DEFAULT_TTL): number {
  ensureCacheDir();
  let cleared = 0;
  const now = Date.now();

  try {
    const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      try {
        const cachedData = fs.readFileSync(filePath, "utf-8");
        const cached: CachedResponse = JSON.parse(cachedData);
        const age = now - cached.metadata.timestamp;

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          removeFromIndex(cached.queryHash);
          cleared++;
        }
      } catch (error) {
        // If file is corrupted, delete it
        fs.unlinkSync(filePath);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`[Ollama Cache] 🗑️  Cleared ${cleared} expired cache entries`);
    }
  } catch (error) {
    console.error("[Ollama Cache] Error clearing expired cache:", error);
  }

  return cleared;
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): number {
  ensureCacheDir();
  let cleared = 0;

  try {
    const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      fs.unlinkSync(filePath);
      cleared++;
    }
    cacheIndex = new Map(); // reset index

    console.log(`[Ollama Cache] 🗑️  Cleared all ${cleared} cache entries`);
  } catch (error) {
    console.error("[Ollama Cache] Error clearing all cache:", error);
  }

  return cleared;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalEntries: number;
  totalHits: number;
  totalSize: number; // in bytes
  averageAge: number; // in minutes
  queryTypes: Record<string, number>;
  topQueries: Array<{ query: string; hits: number; age: number }>;
} {
  ensureCacheDir();
  const stats = {
    totalEntries: 0,
    totalHits: 0,
    totalSize: 0,
    totalAge: 0,
    queryTypes: {} as Record<string, number>,
    queries: [] as Array<{ query: string; hits: number; age: number }>,
  };

  try {
    const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
    const now = Date.now();

    for (const file of files) {
      try {
        const filePath = path.join(CACHE_DIR, file);
        const fileStats = fs.statSync(filePath);
        stats.totalSize += fileStats.size;

        const cachedData = fs.readFileSync(filePath, "utf-8");
        const cached: CachedResponse = JSON.parse(cachedData);

        stats.totalEntries++;
        stats.totalHits += cached.usage.hitCount;
        stats.totalAge += now - cached.metadata.timestamp;

        const queryType = cached.metadata.queryType;
        stats.queryTypes[queryType] = (stats.queryTypes[queryType] || 0) + 1;

        stats.queries.push({
          query: cached.message.substring(0, 50),
          hits: cached.usage.hitCount,
          age: Math.round((now - cached.metadata.timestamp) / 1000 / 60), // minutes
        });
      } catch (error) {
        // Skip corrupted files
        continue;
      }
    }

    // Sort queries by hits and get top 10
    stats.queries.sort((a, b) => b.hits - a.hits);

    return {
      totalEntries: stats.totalEntries,
      totalHits: stats.totalHits,
      totalSize: stats.totalSize,
      averageAge:
        stats.totalEntries > 0
          ? Math.round(stats.totalAge / stats.totalEntries / 1000 / 60)
          : 0,
      queryTypes: stats.queryTypes,
      topQueries: stats.queries.slice(0, 10),
    };
  } catch (error) {
    console.error("[Ollama Cache] Error getting cache stats:", error);
    return {
      totalEntries: 0,
      totalHits: 0,
      totalSize: 0,
      averageAge: 0,
      queryTypes: {},
      topQueries: [],
    };
  }
}

