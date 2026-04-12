"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { IncomeCategoryCombobox } from "./IncomeCategoryCombobox";

const FREQUENCIES = [
  { value: "monthly",  label: "Monthly",  desc: "Every month (e.g. salary)" },
  { value: "yearly",   label: "Yearly",   desc: "Once a year (e.g. bonus)" },
  { value: "one-time", label: "One-time", desc: "Single payment" },
] as const;

type Frequency = (typeof FREQUENCIES)[number]["value"];

const empty = {
  date: new Date().toISOString().split("T")[0],
  description: "",
  category: "",
  amount: "",
  frequency: "monthly" as Frequency,
  note: "",
};

interface AddIncomeModalProps {
  onSuccess?: () => void;
}

export function AddIncomeModal({ onSuccess }: AddIncomeModalProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setForm(empty);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.description.trim()) { setError("Description is required."); return; }
    if (!form.category) { setError("Please select a category."); return; }
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) { setError("Enter a valid amount greater than 0."); return; }

    setIsSaving(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          description: form.description.trim(),
          category: form.category,
          amount,
          type: "credit",
          frequency: form.frequency,
          source: "excel",
          qualityGrade: "A",
        }),
      });

      if (res.ok) {
        reset();
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
        onSuccess?.();
      } else {
        setError("Failed to save income. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Add Income
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <Dialog.Title className="text-xl font-bold text-gray-900">Add Income</Dialog.Title>
              <Dialog.Description className="text-sm text-gray-500 mt-0.5">
                Record salary, interest, dividends or any other income
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Frequency */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Frequency</label>
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    title={f.desc}
                    onClick={() => setForm({ ...form, frequency: f.value })}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      form.frequency === f.value
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Category</label>
              <IncomeCategoryCombobox
                value={form.category}
                onChange={(val) => setForm({ ...form, category: val })}
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={
                  form.category === "salary"
                    ? "e.g. Infosys Monthly Salary"
                    : form.category === "interest"
                    ? "e.g. HDFC FD Interest — Apr 2026"
                    : form.category === "dividends"
                    ? "e.g. TCS Dividend Q4"
                    : "e.g. Rental income — 2BHK Koramangala"
                }
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Date + Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Frequency hint */}
            {form.frequency === "yearly" && form.amount && !isNaN(parseFloat(form.amount)) && (
              <p className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                ≈ ₹{Math.round(parseFloat(form.amount) / 12).toLocaleString("en-IN")}/month effective
              </p>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Dialog.Close asChild>
                <button type="button" className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? "Saving..." : "Save Income"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
