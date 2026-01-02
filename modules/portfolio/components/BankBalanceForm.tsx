"use client";

import { useState } from "react";
import { BankBalance } from "@/core/types";
import { Save, X } from "lucide-react";

interface BankBalanceFormProps {
  initialData?: BankBalance;
  onSave: (bankBalance: BankBalance) => void;
  onCancel: () => void;
}

export function BankBalanceForm({
  initialData,
  onSave,
  onCancel,
}: BankBalanceFormProps) {
  const [formData, setFormData] = useState<Partial<BankBalance>>({
    bankName: initialData?.bankName || "",
    accountNumber: initialData?.accountNumber || "",
    accountType: initialData?.accountType || "savings",
    balance: initialData?.balance || 0,
    currency: initialData?.currency || "INR",
    lastUpdated: initialData?.lastUpdated ? initialData.lastUpdated.split("T")[0] : new Date().toISOString().split("T")[0],
    description: initialData?.description || "",
    status: initialData?.status || "active",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bankBalanceData: BankBalance = {
      id: initialData?.id || `bb-${Date.now()}`,
      bankName: formData.bankName || "",
      accountNumber: formData.accountNumber,
      accountType: formData.accountType || "savings",
      balance: formData.balance || 0,
      currency: formData.currency || "INR",
      lastUpdated: formData.lastUpdated ? new Date(formData.lastUpdated).toISOString() : new Date().toISOString(),
      description: formData.description,
      status: formData.status || "active",
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(bankBalanceData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Bank Name *</label>
          <input
            type="text"
            required
            value={formData.bankName}
            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="e.g., HDFC Bank, SBI"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Account Number</label>
          <input
            type="text"
            value={formData.accountNumber}
            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Account Type *</label>
          <select
            required
            value={formData.accountType}
            onChange={(e) => setFormData({ ...formData, accountType: e.target.value as BankBalance["accountType"] })}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="savings">Savings</option>
            <option value="current">Current</option>
            <option value="salary">Salary</option>
            <option value="fd">Fixed Deposit</option>
            <option value="rd">Recurring Deposit</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Balance (₹) *</label>
          <input
            type="number"
            required
            step="0.01"
            value={formData.balance}
            onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <input
            type="text"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="INR"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Last Updated *</label>
          <input
            type="date"
            required
            value={formData.lastUpdated?.split("T")[0]}
            onChange={(e) => setFormData({ ...formData, lastUpdated: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as BankBalance["status"] })}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="dormant">Dormant</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            rows={2}
            placeholder="Additional notes..."
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>
    </form>
  );
}

