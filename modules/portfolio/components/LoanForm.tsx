"use client";

import { useState } from "react";
import { Loan } from "@/core/types";
import { Save, X } from "lucide-react";
import { ButtonLoader } from "@/shared/components/Loader";

interface LoanFormProps {
  loan?: Loan;
  onSave: (loan: Loan) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function LoanForm({ loan, onSave, onCancel, isSaving = false }: LoanFormProps) {
  const [formData, setFormData] = useState<Partial<Loan>>(
    loan
      ? {
          ...loan,
          startDate: loan.startDate.split("T")[0],
          endDate: loan.endDate ? loan.endDate.split("T")[0] : undefined,
        }
      : {
          name: "",
          type: "home-loan",
          principalAmount: 0,
          outstandingAmount: 0,
          interestRate: 0,
          startDate: new Date().toISOString().split("T")[0],
          emiAmount: 0,
          emiDate: 1,
          tenureMonths: 0,
          status: "active",
        }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const loanData: Loan = {
      id: loan?.id || `loan-${Date.now()}`,
      name: formData.name || "",
      type: formData.type || "home-loan",
      principalAmount: formData.principalAmount || 0,
      outstandingAmount: formData.outstandingAmount || 0,
      interestRate: formData.interestRate || 0,
      startDate: formData.startDate || new Date().toISOString(),
      endDate: formData.endDate,
      emiAmount: formData.emiAmount || 0,
      emiDate: formData.emiDate || 1,
      tenureMonths: formData.tenureMonths || 0,
      description: formData.description,
      status: formData.status || "active",
      isPublished: loan?.isPublished ?? true, // Preserve existing or default to true for new items
      createdAt: loan?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(loanData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Loan Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., House Loan, Car Loan"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Loan Type *
          </label>
          <select
            required
            value={formData.type}
            onChange={(e) =>
              setFormData({
                ...formData,
                type: e.target.value as Loan["type"],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="home-loan">Home Loan</option>
            <option value="car-loan">Car Loan</option>
            <option value="personal-loan">Personal Loan</option>
            <option value="education-loan">Education Loan</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Principal Amount (₹) *
          </label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.principalAmount}
            onChange={(e) =>
              setFormData({
                ...formData,
                principalAmount: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Outstanding Amount (₹) *
          </label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.outstandingAmount}
            onChange={(e) =>
              setFormData({
                ...formData,
                outstandingAmount: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Interest Rate (%) *
          </label>
          <input
            type="number"
            required
            min="0"
            max="100"
            step="0.01"
            value={formData.interestRate}
            onChange={(e) =>
              setFormData({
                ...formData,
                interestRate: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            EMI Amount (₹) *
          </label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.emiAmount}
            onChange={(e) =>
              setFormData({
                ...formData,
                emiAmount: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            EMI Date (Day of Month) *
          </label>
          <input
            type="number"
            required
            min="1"
            max="31"
            value={formData.emiDate}
            onChange={(e) =>
              setFormData({
                ...formData,
                emiDate: parseInt(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tenure (Months) *
          </label>
          <input
            type="number"
            required
            min="1"
            value={formData.tenureMonths}
            onChange={(e) =>
              setFormData({
                ...formData,
                tenureMonths: parseInt(e.target.value),
              })
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
            Status *
          </label>
          <select
            required
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as Loan["status"],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="foreclosed">Foreclosed</option>
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
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <ButtonLoader />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Loan
            </>
          )}
        </button>
      </div>
    </form>
  );
}

