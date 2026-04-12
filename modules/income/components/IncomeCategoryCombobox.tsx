"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";

export const INCOME_GROUPS: Record<string, { slug: string; label: string; desc: string }[]> = {
  "Earned Income": [
    { slug: "salary", label: "Salary", desc: "Monthly/yearly salary from employer" },
    { slug: "freelance", label: "Freelance / Consulting", desc: "Contract, freelance or consulting fees" },
    { slug: "bonus", label: "Bonus / Incentive", desc: "Annual bonus, performance incentive" },
    { slug: "business-income", label: "Business Income", desc: "Business profits, owner draws" },
  ],
  "Passive Income": [
    { slug: "interest", label: "Interest Income", desc: "FD, savings account, bonds interest" },
    { slug: "dividends", label: "Dividends", desc: "Stock or mutual fund dividends" },
    { slug: "rental-income", label: "Rental Income", desc: "Rental from property" },
    { slug: "royalties", label: "Royalties", desc: "Royalty from intellectual property" },
  ],
  "Investment Returns": [
    { slug: "capital-gains", label: "Capital Gains", desc: "Profit from selling stocks/MF/property" },
    { slug: "maturity-proceeds", label: "Maturity Proceeds", desc: "FD/bond/PPF maturity" },
    { slug: "ppf-withdrawal", label: "PPF Withdrawal", desc: "Partial or full PPF withdrawal" },
  ],
  "Other Income": [
    { slug: "refunds", label: "Refunds / Cashback", desc: "Tax refund, product refund, cashback" },
    { slug: "gifts-received", label: "Gifts Received", desc: "Cash gifts, inheritance" },
    { slug: "other-income", label: "Other Income", desc: "Any other income not listed above" },
  ],
};

export const ALL_INCOME_SLUGS = Object.values(INCOME_GROUPS).flatMap((g) => g.map((i) => i.slug));

function findItem(slug: string) {
  for (const items of Object.values(INCOME_GROUPS)) {
    const found = items.find((i) => i.slug === slug);
    if (found) return found;
  }
  return null;
}

interface IncomeCategoryComboboxProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export function IncomeCategoryCombobox({
  value,
  onChange,
  placeholder = "Select income category...",
}: IncomeCategoryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const q = search.toLowerCase().trim();
  const filtered = Object.entries(INCOME_GROUPS)
    .map(([group, items]) => ({
      group,
      items: q
        ? items.filter((i) => i.label.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q))
        : items,
    }))
    .filter((g) => g.items.length > 0);

  const selected = findItem(value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center justify-between w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search income category..."
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={(e) => { if (e.key === "Escape") { setIsOpen(false); setSearch(""); } }}
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.map(({ group, items }) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 sticky top-0">
                  {group}
                </div>
                {items.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => { onChange(item.slug); setIsOpen(false); setSearch(""); }}
                    className="flex items-start justify-between w-full px-4 py-2.5 hover:bg-emerald-50 hover:text-emerald-700 text-left group"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800 group-hover:text-emerald-700">
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                    {value === item.slug && <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">No categories found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
