"use client";

import { useQuery } from "@tanstack/react-query";
import { DynamicCategory, CategoryLearning } from "@/core/types";
import { TrendingUp, Brain, RefreshCw } from "lucide-react";

export function DynamicCategoriesView() {
  const { data, isLoading, refetch } = useQuery<{
    categories: DynamicCategory[];
    patterns: CategoryLearning[];
  }>({
    queryKey: ["dynamic-categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories/dynamic");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading categories...</span>
        </div>
      </div>
    );
  }

  const categories = data?.categories || [];
  const patterns = data?.patterns || [];

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-semibold">AI-Generated Categories</h2>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Categories dynamically created by AI from your uploaded data. The system learns and improves with each upload.
      </p>

      {categories.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No categories yet. Upload Excel files to generate categories.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-3">Investment Categories</h3>
            <div className="flex flex-wrap gap-2">
              {categories
                .filter((c) => c.type === "investment")
                .map((category) => (
                  <div
                    key={category.id}
                    className="px-3 py-2 bg-green-100 text-green-800 rounded-lg flex items-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs bg-green-200 px-2 py-0.5 rounded">
                      {category.usageCount}x
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Loan Categories</h3>
            <div className="flex flex-wrap gap-2">
              {categories
                .filter((c) => c.type === "loan")
                .map((category) => (
                  <div
                    key={category.id}
                    className="px-3 py-2 bg-red-100 text-red-800 rounded-lg flex items-center gap-2"
                  >
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs bg-red-200 px-2 py-0.5 rounded">
                      {category.usageCount}x
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Property Categories</h3>
            <div className="flex flex-wrap gap-2">
              {categories
                .filter((c) => c.type === "property")
                .map((category) => (
                  <div
                    key={category.id}
                    className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg flex items-center gap-2"
                  >
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs bg-blue-200 px-2 py-0.5 rounded">
                      {category.usageCount}x
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {patterns.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-3">Learned Patterns ({patterns.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {patterns.slice(0, 10).map((pattern) => (
                  <div
                    key={pattern.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                  >
                    <div>
                      <span className="font-medium">"{pattern.pattern}"</span>
                      <span className="text-gray-600 ml-2">→ {pattern.category}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Confidence: {(pattern.confidence * 100).toFixed(0)}%</span>
                      <span>•</span>
                      <span>Used: {pattern.usageCount}x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

