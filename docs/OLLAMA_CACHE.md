# Ollama Query Cache

This document describes the caching mechanism for Ollama queries to improve response times and reduce API calls.

## Overview

The Ollama cache service automatically caches responses from Ollama API calls, allowing faster responses for repeated or similar queries. The cache is stored in `.cache/ollama-responses/` directory.

## Features

- **Automatic Caching**: All Ollama queries are automatically cached
- **TTL Support**: Cache entries expire after a configurable time (default: 24 hours)
- **Hash-based Keys**: Uses MD5 hash of message + system prompt for cache keys
- **Usage Tracking**: Tracks cache hits and access times
- **Statistics**: Provides detailed cache statistics

## Configuration

Set these environment variables to configure caching:

```bash
# Enable/disable cache (default: true)
OLLAMA_CACHE_ENABLED=true

# Cache TTL in milliseconds (default: 86400000 = 24 hours)
OLLAMA_CACHE_TTL=86400000

# Enable/disable fuzzy matching for similar queries (default: true)
OLLAMA_CACHE_FUZZY_ENABLED=true

# Fuzzy match similarity threshold 0-1 (default: 0.85 = 85% similarity)
OLLAMA_CACHE_FUZZY_THRESHOLD=0.85

# Minimum query length for fuzzy matching (default: 10 characters)
OLLAMA_CACHE_MIN_QUERY_LENGTH=10
```

## Usage

The cache is automatically integrated into all Ollama service functions:

### generateChatContent
```typescript
import { generateChatContent } from '@/core/services/ollamaService';

// Normal usage (uses cache)
const response = await generateChatContent(message, systemPrompt);

// Bypass cache
const response = await generateChatContent(message, systemPrompt, { bypassCache: true });
```

### generateContent
```typescript
import { generateContent } from '@/core/services/ollamaService';

// Normal usage (uses cache)
const response = await generateContent(prompt, systemPrompt);

// Bypass cache
const response = await generateContent(prompt, systemPrompt, { bypassCache: true });
```

### generateJsonContent
```typescript
import { generateJsonContent } from '@/core/services/ollamaService';

// Normal usage (uses cache)
const data = await generateJsonContent(prompt, systemPrompt);

// Bypass cache
const data = await generateJsonContent(prompt, systemPrompt, { bypassCache: true });
```

## Cache Management

### Get Cache Statistics

```bash
GET /api/ollama/cache/stats
```

Response:
```json
{
  "success": true,
  "stats": {
    "totalEntries": 150,
    "totalHits": 450,
    "totalSize": 2048000,
    "averageAge": 120,
    "queryTypes": {
      "chat": 100,
      "content": 30,
      "json": 20
    },
    "topQueries": [
      {
        "query": "What is my total investment value?",
        "hits": 25,
        "age": 60
      }
    ]
  }
}
```

### Clear Cache

```bash
# Clear all cache
DELETE /api/ollama/cache/clear

# Clear only expired entries
DELETE /api/ollama/cache/clear?type=expired

# Clear specific query
DELETE /api/ollama/cache/clear?type=specific&message=your message&systemPrompt=your system prompt
```

## Cache Service API

### Direct Usage

```typescript
import {
  loadFromCache,
  saveToCache,
  invalidateCache,
  clearAllCache,
  clearExpiredCache,
  getCacheStats,
} from '@/core/services/ollamaCacheService';

// Load from cache
const cached = await loadFromCache(message, systemPrompt);

// Save to cache
await saveToCache(message, systemPrompt, response, {
  model: 'llama3:latest',
  queryType: 'chat',
  responseTime: 1500,
  ttl: 86400000, // 24 hours
});

// Invalidate specific cache
invalidateCache(message, systemPrompt);

// Clear all cache
clearAllCache();

// Clear expired cache
clearExpiredCache(86400000); // 24 hours

// Get statistics
const stats = getCacheStats();
```

## How It Works

1. **Cache Key Generation**: Creates an MD5 hash of `message + systemPrompt`
2. **Cache Lookup**: Before making an Ollama API call, checks if a cached response exists
   - **Exact Match**: First tries to find an exact match (same message + system prompt)
   - **Fuzzy Match**: If exact match not found, searches for similar queries using Levenshtein distance
   - **Similarity Threshold**: Only matches queries with similarity ≥ 85% (configurable)
3. **Cache Hit**: If found and not expired, returns cached response immediately
4. **Cache Miss**: Makes API call, saves response to cache, then returns response
5. **Expiration**: Cache entries older than TTL are automatically removed

### Fuzzy Matching

The cache now supports fuzzy matching to handle:
- **Spelling mistakes**: "What is my total invesment?" matches "What is my total investment?"
- **Minor variations**: "show me my investments" matches "Show me my investments"
- **Similar queries**: "total portfolio value" matches "what is my total portfolio value?"

Fuzzy matching uses:
- **Text normalization**: Lowercase, removes punctuation, normalizes spaces
- **Levenshtein distance**: Calculates edit distance between queries
- **Similarity ratio**: Returns matches with ≥85% similarity (configurable)

## Benefits

- **Faster Responses**: Cached queries return instantly (typically < 10ms vs 1-5 seconds)
- **Reduced API Calls**: Saves on Ollama API usage
- **Consistent Responses**: Same queries return identical responses
- **Better Performance**: Reduces server load and improves user experience

## Cache Storage

Cache files are stored in `.cache/ollama-responses/` directory. Each cache entry is a JSON file with:
- Query hash (filename)
- Original message and system prompt
- Cached response
- Metadata (timestamp, model, query type, response time)
- Usage statistics (hit count, last accessed)

## Best Practices

1. **Use appropriate TTL**: Set TTL based on how often your data changes
2. **Clear cache when data changes**: Invalidate cache when portfolio data is updated
3. **Monitor cache size**: Regularly clear expired entries
4. **Bypass cache for real-time data**: Use `bypassCache: true` for queries requiring fresh data

## Troubleshooting

### Cache not working
- Check `OLLAMA_CACHE_ENABLED` is not set to `false`
- Verify `.cache/ollama-responses/` directory exists and is writable
- Check logs for cache-related errors

### Cache too large
- Reduce TTL to expire entries faster
- Clear expired cache regularly: `DELETE /api/ollama/cache/clear?type=expired`
- Clear all cache if needed: `DELETE /api/ollama/cache/clear`

### Stale responses
- Reduce TTL for faster expiration
- Use `bypassCache: true` for queries requiring fresh data
- Clear cache when underlying data changes

