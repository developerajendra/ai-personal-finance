"use client";

import { useState } from "react";
import { Investment } from "@/core/types";
import { Save, X } from "lucide-react";

interface InvestmentFormProps {
  investment?: Investment;
  onSave: (investment: Investment) => void;
  onCancel: () => void;
}

export function InvestmentForm({ investment, onSave, onCancel }: InvestmentFormProps) {
  const [formData, setFormData] = useState<Partial<Investment>>(
    investment
      ? {
          ...investment,
          startDate: investment.startDate.split("T")[0],
          maturityDate: investment.maturityDate
            ? investment.maturityDate.split("T")[0]
            : undefined,
          endDate: investment.endDate ? investment.endDate.split("T")[0] : undefined,
        }
      : {
          name: "",
          amount: 0,
          type: "ppf",
          startDate: new Date().toISOString().split("T")[0],
          status: "active",
        }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const investmentData: Investment = {
      id: investment?.id || `inv-${Date.now()}`,
      name: formData.name || "",
      amount: formData.amount || 0,
      type: formData.type || "ppf",
      startDate: formData.startDate || new Date().toISOString(),
      endDate: formData.endDate,
      maturityDate: formData.maturityDate,
      interestRate: formData.interestRate,
      description: formData.description,
      status: formData.status || "active",
      createdAt: investment?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(investmentData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Investment Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., PPF, FD, Mutual Fund"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type *
          </label>
          <select
            required
            value={formData.type}
            onChange={(e) =>
              setFormData({
                ...formData,
                type: e.target.value as Investment["type"],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ppf">PPF</option>
            <option value="fd">Fixed Deposit</option>
            <option value="mutual-fund">Mutual Fund</option>
            <option value="stocks">Stocks</option>
            <option value="bonds">Bonds</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount (₹) *
          </label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: parseFloat(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date *
          </label>
          <input
            type="date"
            required
            value={formData.startDate}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Maturity Date (Optional)
          </label>
          <input
            type="date"
            value={formData.maturityDate || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                maturityDate: e.target.value || undefined,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date (Optional)
          </label>
          <input
            type="date"
            value={formData.endDate || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                endDate: e.target.value || undefined,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Interest Rate (%) (Optional)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.interestRate || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                interestRate: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status *
          </label>
          <select
            required
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as Investment["status"],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Active</option>
            <option value="matured">Matured</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description (Optional)
        </label>
        <textarea
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Investment
        </button>
      </div>
    </form>
  );
}

