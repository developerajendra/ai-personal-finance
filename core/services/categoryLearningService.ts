import { CategoryLearning, DynamicCategory } from "@/core/types";

// In-memory storage - in production, use database
let categoryPatterns: CategoryLearning[] = [];
let dynamicCategories: DynamicCategory[] = [];

export interface CategorizationResult {
  category: string;
  confidence: number;
  source: "ai" | "learned" | "pattern";
}

/**
 * Learn from AI categorization results
 */
export function learnFromCategorization(
  entity: string,
  aiCategory: string,
  aiType: string
): void {
  // Extract patterns from entity name
  const patterns = extractPatterns(entity);

  patterns.forEach((pattern) => {
    const existing = categoryPatterns.find(
      (p) => p.pattern === pattern && p.category === aiCategory
    );

    if (existing) {
      existing.usageCount++;
      existing.lastUsed = new Date().toISOString();
      // Increase confidence with more usage
      existing.confidence = Math.min(1, existing.confidence + 0.01);
    } else {
      categoryPatterns.push({
        id: `pattern-${Date.now()}-${Math.random()}`,
        pattern,
        category: aiCategory,
        confidence: 0.7, // Start with medium confidence
        usageCount: 1,
        successRate: 0.7,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      });
    }
  });

  // Update or create dynamic category
  updateDynamicCategory(aiCategory, aiType);
}

/**
 * Extract patterns from entity name for learning
 */
function extractPatterns(entity: string): string[] {
  const patterns: string[] = [];
  const lower = entity.toLowerCase();

  // Extract key words
  const words = lower.split(/\s+/);
  words.forEach((word) => {
    if (word.length > 2) {
      patterns.push(word);
    }
  });

  // Extract common financial terms
  const financialTerms = [
    "ppf", "fd", "mutual", "fund", "stock", "bond", "loan", "house",
    "property", "plot", "bank", "deposit", "investment", "savings",
  ];

  financialTerms.forEach((term) => {
    if (lower.includes(term)) {
      patterns.push(term);
    }
  });

  return [...new Set(patterns)]; // Remove duplicates
}

/**
 * Get category suggestion based on learned patterns
 */
export function suggestCategory(entity: string): CategorizationResult | null {
  const lower = entity.toLowerCase();
  let bestMatch: CategoryLearning | null = null;
  let bestScore = 0;

  for (const pattern of categoryPatterns) {
    if (lower.includes(pattern.pattern.toLowerCase())) {
      const score = pattern.confidence * pattern.successRate;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }
  }

  if (bestMatch && bestScore > 0.5) {
    return {
      category: bestMatch.category,
      confidence: bestScore,
      source: "learned",
    };
  }

  return null;
}

/**
 * Update or create dynamic category
 */
function updateDynamicCategory(name: string, type: string): void {
  const existing = dynamicCategories.find((c) => c.name === name);

  if (existing) {
    existing.usageCount++;
    existing.updatedAt = new Date().toISOString();
  } else {
    dynamicCategories.push({
      id: `cat-${Date.now()}-${Math.random()}`,
      name,
      type: type as DynamicCategory["type"],
      usageCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Get all dynamic categories
 */
export function getDynamicCategories(): DynamicCategory[] {
  return dynamicCategories;
}

/**
 * Get category learning patterns
 */
export function getCategoryPatterns(): CategoryLearning[] {
  return categoryPatterns;
}

/**
 * Provide feedback on categorization accuracy
 */
export function provideFeedback(
  patternId: string,
  wasCorrect: boolean
): void {
  const pattern = categoryPatterns.find((p) => p.id === patternId);
  if (pattern) {
    if (wasCorrect) {
      pattern.successRate = Math.min(1, pattern.successRate + 0.05);
      pattern.confidence = Math.min(1, pattern.confidence + 0.02);
    } else {
      pattern.successRate = Math.max(0, pattern.successRate - 0.1);
      pattern.confidence = Math.max(0.3, pattern.confidence - 0.05);
    }
    pattern.lastUsed = new Date().toISOString();
  }
}

