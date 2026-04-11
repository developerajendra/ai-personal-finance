"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";
import { CATEGORIES, EXPENSE_GROUPS } from "@/core/config/constants";

const STORAGE_KEY = "custom_expense_categories";

function formatLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function loadCustomCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomCategories(cats: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
}

interface CategoryComboboxProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

// All built-in grouped sections for the dropdown
const INCOME_CATEGORIES = [...CATEGORIES.INCOME];
const INVESTMENT_CATEGORIES = [...CATEGORIES.INVESTMENTS];
const TRANSFER_CATEGORIES = [...CATEGORIES.TRANSFERS];

export function CategoryCombobox({
  value,
  onChange,
  placeholder = "Search category...",
  className = "",
}: CategoryComboboxProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomCategories(loadCustomCategories());
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const q = search.toLowerCase().trim();

  function matchesSearch(slug: string) {
    if (!q) return true;
    return slug.includes(q) || formatLabel(slug).toLowerCase().includes(q);
  }

  function handleSelect(slug: string) {
    onChange(slug);
    setSearch("");
    setIsOpen(false);
  }

  function handleCreateNew() {
    const newSlug = search.trim().toLowerCase().replace(/\s+/g, "-");
    if (!newSlug) return;
    const updated = [...customCategories, newSlug];
    setCustomCategories(updated);
    saveCustomCategories(updated);
    onChange(newSlug);
    setSearch("");
    setIsOpen(false);
  }

  // Build grouped sections
  const sections: { label: string; slugs: string[] }[] = [
    ...(customCategories.length > 0
      ? [{ label: "My Categories", slugs: customCategories.filter(matchesSearch) }]
      : []),
    ...Object.entries(EXPENSE_GROUPS).map(([label, slugs]) => ({
      label,
      slugs: slugs.filter(matchesSearch),
    })),
    { label: "Income", slugs: INCOME_CATEGORIES.filter(matchesSearch) },
    { label: "Investments", slugs: INVESTMENT_CATEGORIES.filter(matchesSearch) },
    { label: "Transfers", slugs: TRANSFER_CATEGORIES.filter(matchesSearch) },
  ].filter((s) => s.slugs.length > 0);

  const totalMatches = sections.reduce((n, s) => n + s.slugs.length, 0);
  const showCreateOption = q.length > 0 && totalMatches === 0;
  const showCreateSuggestion =
    q.length > 0 &&
    !CATEGORIES.EXPENSES.includes(q.replace(/\s+/g, "-") as never) &&
    !customCategories.includes(q.replace(/\s+/g, "-"));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {value ? formatLabel(value) : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or type new category..."
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && showCreateOption) handleCreateNew();
                if (e.key === "Escape") { setIsOpen(false); setSearch(""); }
              }}
            />
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto">
            {sections.map((section) => (
              <div key={section.label}>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 sticky top-0">
                  {section.label}
                </div>
                {section.slugs.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => handleSelect(slug)}
                    className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span>{formatLabel(slug)}</span>
                    {value === slug && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            ))}

            {/* Create new option */}
            {(showCreateOption || showCreateSuggestion) && (
              <div className={showCreateOption ? "" : "border-t border-gray-100"}>
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create &quot;{search.trim()}&quot; as new category
                </button>
              </div>
            )}

            {totalMatches === 0 && !showCreateOption && (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">
                No categories found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
