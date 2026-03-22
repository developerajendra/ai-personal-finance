'use client';

import { useState, useMemo } from 'react';
import { PPFAccount } from '@/core/services/ppfStorageService';
import { Save, X } from 'lucide-react';
import { ButtonLoader } from '@/shared/components/Loader';

interface ProvidentFundEditFormProps {
  account: PPFAccount;
  onSave: (account: PPFAccount) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function ProvidentFundEditForm({
  account,
  onSave,
  onCancel,
  isSaving = false,
}: ProvidentFundEditFormProps) {
  const [formData, setFormData] = useState<Partial<PPFAccount>>({
    ...account,
    memberId: account.memberId ?? '',
    memberName: account.memberName ?? '',
    establishmentId: account.establishmentId ?? '',
    establishmentName: account.establishmentName ?? '',
    depositEmployeeShare: account.depositEmployeeShare ?? 0,
    depositEmployerShare: account.depositEmployerShare ?? 0,
    withdrawEmployeeShare: account.withdrawEmployeeShare ?? 0,
    withdrawEmployerShare: account.withdrawEmployerShare ?? 0,
    pensionContribution: account.pensionContribution ?? 0,
  });

  const grandTotal = useMemo(
    () =>
      (formData.depositEmployeeShare ?? 0) +
      (formData.depositEmployerShare ?? 0) -
      (formData.withdrawEmployeeShare ?? 0) -
      (formData.withdrawEmployerShare ?? 0) +
      (formData.pensionContribution ?? 0),
    [
      formData.depositEmployeeShare,
      formData.depositEmployerShare,
      formData.withdrawEmployeeShare,
      formData.withdrawEmployerShare,
      formData.pensionContribution,
    ]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? v : 0);
    const accountData: PPFAccount = {
      id: account.id,
      memberId: formData.memberId?.trim() || undefined,
      memberName: formData.memberName?.trim() || undefined,
      establishmentId: formData.establishmentId?.trim() || undefined,
      establishmentName: formData.establishmentName?.trim() || undefined,
      depositEmployeeShare: num(formData.depositEmployeeShare),
      depositEmployerShare: num(formData.depositEmployerShare),
      withdrawEmployeeShare: num(formData.withdrawEmployeeShare),
      withdrawEmployerShare: num(formData.withdrawEmployerShare),
      pensionContribution: num(formData.pensionContribution),
      grandTotal,
      extractedFrom: account.extractedFrom,
      extractedAt: account.extractedAt,
      rawData: account.rawData,
    };
    onSave(accountData);
  };

  const parseNum = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Member ID
          </label>
          <input
            type="text"
            value={formData.memberId ?? ''}
            onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
            placeholder="e.g., MRNOI00540970000010276"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Member Name
          </label>
          <input
            type="text"
            value={formData.memberName ?? ''}
            onChange={(e) => setFormData({ ...formData, memberName: e.target.value })}
            placeholder="e.g., RAJENDRA PRASAD"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Establishment ID
          </label>
          <input
            type="text"
            value={formData.establishmentId ?? ''}
            onChange={(e) => setFormData({ ...formData, establishmentId: e.target.value })}
            placeholder="e.g., MRNOI0054097000/TO"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Establishment Name
          </label>
          <input
            type="text"
            value={formData.establishmentName ?? ''}
            onChange={(e) => setFormData({ ...formData, establishmentName: e.target.value })}
            placeholder="e.g., INTELLIGRAPE SOFTWARE"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deposit - Employee Share (₹)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={formData.depositEmployeeShare ?? 0}
            onChange={(e) =>
              setFormData({
                ...formData,
                depositEmployeeShare: parseNum(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deposit - Employer Share (₹)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={formData.depositEmployerShare ?? 0}
            onChange={(e) =>
              setFormData({
                ...formData,
                depositEmployerShare: parseNum(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Withdraw - Employee Share (₹)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={formData.withdrawEmployeeShare ?? 0}
            onChange={(e) =>
              setFormData({
                ...formData,
                withdrawEmployeeShare: parseNum(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Withdraw - Employer Share (₹)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={formData.withdrawEmployerShare ?? 0}
            onChange={(e) =>
              setFormData({
                ...formData,
                withdrawEmployerShare: parseNum(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pension Contribution (₹)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={formData.pensionContribution ?? 0}
            onChange={(e) =>
              setFormData({
                ...formData,
                pensionContribution: parseNum(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Grand Total (₹) <span className="text-gray-400 font-normal">(auto-calculated)</span>
          </label>
          <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900 font-semibold">
            ₹{grandTotal.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-4">
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
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}
