'use client';

import { useState, useMemo } from 'react';
import { BankBalance } from '@/core/types';
import { Save, X } from 'lucide-react';
import { ButtonLoader } from '@/shared/components/Loader';
import { convertToINR, convertFromINR, getConversionRateText, getCurrencySymbol, type Currency } from '@/core/services/currencyService';

interface BankBalanceFormProps {
  initialData?: BankBalance;
  onSave: (bankBalance: BankBalance) => void;
  onCancel: () => void;
  isSaving?: boolean;
  isReceivable?: boolean; // Flag to indicate if this is a receivable form
}

export function BankBalanceForm({
  initialData,
  onSave,
  onCancel,
  isSaving = false,
  isReceivable = false,
}: BankBalanceFormProps) {
  // Determine if this is a receivable (check prop or tags)
  const isReceivableForm = isReceivable || initialData?.tags?.includes('receivable') || false;
  
  // Determine initial currency - use originalCurrency if available, otherwise currency, default to INR
  const initialCurrency = (initialData?.originalCurrency || initialData?.currency || 'INR') as Currency;
  // For backward compatibility: if no originalAmount, use balance (assuming it's already in the correct currency)
  // If currency is INR and no originalAmount, assume balance is the original amount
  const initialAmount = initialData?.originalAmount ?? (initialCurrency === 'INR' ? (initialData?.balance ?? 0) : (initialData?.balance ?? 0));

  const [formData, setFormData] = useState<Partial<BankBalance>>({
    bankName: initialData?.bankName || '',
    accountNumber: initialData?.accountNumber || '',
    accountType: initialData?.accountType || 'savings',
    assetType: initialData?.assetType || 'liquid', // Bank balances and receivables are always liquid
    balance: initialData?.balance || 0, // This will be in INR
    currency: initialCurrency,
    originalAmount: initialAmount,
    originalCurrency: initialCurrency,
    lastUpdated: initialData?.lastUpdated
      ? initialData.lastUpdated.split('T')[0]
      : new Date().toISOString().split('T')[0],
    description: initialData?.description || '',
    status: initialData?.status || 'active',
    issueDate: initialData?.issueDate ? initialData.issueDate.split('T')[0] : '',
    dueDate: initialData?.dueDate ? initialData.dueDate.split('T')[0] : '',
    interestRate: initialData?.interestRate || undefined,
    tags: initialData?.tags || [],
  });

  const selectedCurrency = (formData.currency || 'INR') as Currency;
  const inputAmount = formData.originalAmount ?? formData.balance ?? 0;

  // Calculate INR converted value
  const inrConvertedValue = useMemo(() => {
    if (selectedCurrency === 'INR') {
      return inputAmount;
    }
    return convertToINR(inputAmount, selectedCurrency);
  }, [inputAmount, selectedCurrency]);

  // Get conversion rate text for tooltip
  const conversionRateText = useMemo(() => {
    if (selectedCurrency === 'INR') {
      return null;
    }
    return getConversionRateText(selectedCurrency, 'INR');
  }, [selectedCurrency]);

  // Calculate interest and expected total for receivables
  const interestCalculation = useMemo(() => {
    if (!isReceivableForm) {
      return null;
    }

    const principal = inrConvertedValue;
    const principalOriginal = selectedCurrency === 'INR' ? inputAmount : convertFromINR(principal, selectedCurrency);
    
    // If no interest rate or issue date, return just the principal (Expected Total = Amount Given)
    if (!formData.interestRate || !formData.issueDate) {
      return {
        principal,
        principalOriginal,
        interestRate: 0,
        daysDiff: 0,
        years: 0,
        interestAmount: 0,
        interestAmountOriginal: 0,
        totalWithInterest: principal,
        totalWithInterestOriginal: principalOriginal,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
        currency: selectedCurrency,
        hasInterest: false,
      };
    }

    const interestRate = formData.interestRate / 100; // Convert percentage to decimal
    const issueDate = new Date(formData.issueDate);
    const currentDate = new Date();
    const dueDate = formData.dueDate ? new Date(formData.dueDate) : null;

    // Calculate days from issue date to current date (or due date if provided)
    const endDate = dueDate && dueDate > currentDate ? dueDate : currentDate;
    const daysDiff = Math.max(0, Math.floor((endDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
    const years = daysDiff / 365;

    // Simple interest calculation: Principal * Rate * Time
    const interestAmount = principal * interestRate * years;
    const totalWithInterest = principal + interestAmount;

    // Convert back to original currency if not INR
    const interestAmountOriginal = selectedCurrency === 'INR' ? interestAmount : convertFromINR(interestAmount, selectedCurrency);
    const totalWithInterestOriginal = selectedCurrency === 'INR' ? totalWithInterest : convertFromINR(totalWithInterest, selectedCurrency);

    return {
      principal,
      principalOriginal,
      interestRate: formData.interestRate,
      daysDiff,
      years,
      interestAmount,
      interestAmountOriginal,
      totalWithInterest,
      totalWithInterestOriginal,
      dueDate,
      currency: selectedCurrency,
      hasInterest: true,
    };
  }, [isReceivableForm, formData.interestRate, formData.issueDate, formData.dueDate, inrConvertedValue, selectedCurrency, inputAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currency = (formData.currency || 'INR') as Currency;
    const originalAmount = formData.originalAmount ?? inputAmount;
    
    // Always store balance in INR for calculations
    const balanceInINR = currency === 'INR' ? originalAmount : convertToINR(originalAmount, currency);

    const bankBalanceData: BankBalance = {
      id: initialData?.id || `bb-${Date.now()}`,
      bankName: formData.bankName || '',
      accountNumber: formData.accountNumber,
      accountType: formData.accountType || 'savings',
      balance: balanceInINR, // Always in INR
      currency: currency,
      originalAmount: originalAmount,
      originalCurrency: currency,
      lastUpdated: formData.lastUpdated
        ? new Date(formData.lastUpdated).toISOString()
        : new Date().toISOString(),
      description: formData.description,
      status: formData.status || 'active',
      assetType: formData.assetType || 'liquid', // Bank balances and receivables default to liquid
      isPublished: initialData?.isPublished ?? true, // Preserve existing or default to true for new items
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Receivables fields
      issueDate: formData.issueDate ? new Date(formData.issueDate).toISOString() : undefined,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
      interestRate: formData.interestRate,
      tags: formData.tags,
    };
    onSave(bankBalanceData);
  };

  const handleCurrencyChange = (newCurrency: Currency) => {
    const currentAmount = formData.originalAmount ?? formData.balance ?? 0;
    setFormData({
      ...formData,
      currency: newCurrency,
      originalCurrency: newCurrency,
      originalAmount: currentAmount,
      // Balance will be recalculated on submit
    });
  };

  const handleAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData({
      ...formData,
      originalAmount: numValue,
      // Balance will be calculated on submit
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            {isReceivableForm ? 'Debtor Name' : 'Bank Name'} *
          </label>
          <input
            type="text"
            required
            value={formData.bankName}
            onChange={(e) =>
              setFormData({ ...formData, bankName: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg"
            placeholder={isReceivableForm ? "e.g., John Doe, ABC Company" : "e.g., HDFC Bank, SBI"}
          />
        </div>

        {!isReceivableForm && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Account Number
            </label>
            <input
              type="text"
              value={formData.accountNumber}
              onChange={(e) =>
                setFormData({ ...formData, accountNumber: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Optional"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Account Type *
          </label>
          <select
            required
            value={formData.accountType}
            onChange={(e) =>
              setFormData({
                ...formData,
                accountType: e.target.value as BankBalance['accountType'],
              })
            }
            className="w-full px-3 py-2 border rounded-lg">
            <option value="savings">Savings</option>
            <option value="current">Current</option>
            <option value="salary">Salary</option>
            <option value="fd">Fixed Deposit</option>
            <option value="rd">Recurring Deposit</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Asset Type *
          </label>
          <select
            required
            value={formData.assetType || 'liquid'}
            onChange={(e) =>
              setFormData({
                ...formData,
                assetType: e.target.value as 'fixed' | 'liquid',
              })
            }
            className="w-full px-3 py-2 border rounded-lg">
            <option value="liquid">Liquid Asset</option>
            <option value="fixed">Fixed Asset</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {isReceivableForm ? 'Amount Given' : 'Balance'} ({getCurrencySymbol(selectedCurrency)}) *
          </label>
          <div className="relative">
            <input
              type="number"
              required
              step="0.01"
              value={inputAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg pr-20"
              placeholder="0.00"
              title={conversionRateText || undefined}
            />
            {conversionRateText && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200 whitespace-nowrap">
                ≈ ₹{inrConvertedValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
          {conversionRateText && (
            <p className="text-xs text-gray-500 mt-1" title={conversionRateText}>
              {conversionRateText}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Currency *</label>
          <select
            required
            value={selectedCurrency}
            onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
            className="w-full px-3 py-2 border rounded-lg">
            <option value="INR">INR (Indian Rupee)</option>
            <option value="NPR">NPR (Nepalese Rupee)</option>
            <option value="USD">USD (US Dollar)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Last Updated *
          </label>
          <input
            type="date"
            required
            value={formData.lastUpdated?.split('T')[0]}
            onChange={(e) =>
              setFormData({ ...formData, lastUpdated: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as BankBalance['status'],
              })
            }
            className="w-full px-3 py-2 border rounded-lg">
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="dormant">Dormant</option>
          </select>
        </div>

        {/* Receivables-specific fields */}
        {isReceivableForm && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={formData.issueDate || ''}
                onChange={(e) =>
                  setFormData({ ...formData, issueDate: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate || ''}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Interest Rate (% per annum)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.interestRate || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    interestRate: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g., 12.5"
              />
            </div>

            {/* Display calculated interest and expected total */}
            {interestCalculation && (
              <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm text-blue-900">
                  {interestCalculation.hasInterest ? 'Interest Calculation' : 'Amount Summary'}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Amount Given:</span>
                    {interestCalculation.currency !== 'INR' ? (
                      <span className="ml-2 font-medium">
                        {getCurrencySymbol(interestCalculation.currency)}{interestCalculation.principalOriginal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                        <span className="text-xs text-gray-500 ml-1">
                          (₹{interestCalculation.principal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                        </span>
                      </span>
                    ) : (
                      <span className="ml-2 font-medium">₹{interestCalculation.principal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                  </div>
                  {interestCalculation.hasInterest && (
                    <>
                      <div>
                        <span className="text-gray-600">Interest Rate:</span>
                        <span className="ml-2 font-medium">{interestCalculation.interestRate}% p.a.</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Days Elapsed:</span>
                        <span className="ml-2 font-medium">{interestCalculation.daysDiff} days</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Time Period:</span>
                        <span className="ml-2 font-medium">{interestCalculation.years.toFixed(4)} years</span>
                      </div>
                      <div className="col-span-2 border-t border-blue-300 pt-2">
                        <span className="text-gray-600">Interest Amount:</span>
                        {interestCalculation.currency !== 'INR' ? (
                          <span className="ml-2 font-semibold text-green-700">
                            {getCurrencySymbol(interestCalculation.currency)}{interestCalculation.interestAmountOriginal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                            <span className="text-xs text-gray-500 ml-1">
                              (₹{interestCalculation.interestAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </span>
                          </span>
                        ) : (
                          <span className="ml-2 font-semibold text-green-700">₹{interestCalculation.interestAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        )}
                      </div>
                    </>
                  )}
                  <div className="col-span-2 border-t border-blue-300 pt-2">
                    <span className="text-gray-600">
                      {interestCalculation.dueDate 
                        ? 'Expected Total (at Due Date):' 
                        : 'Expected Total:'}
                    </span>
                    {interestCalculation.currency !== 'INR' ? (
                      <span className="ml-2 font-bold text-blue-700">
                        {getCurrencySymbol(interestCalculation.currency)}{interestCalculation.totalWithInterestOriginal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                        <span className="text-xs text-gray-500 ml-1">
                          (₹{interestCalculation.totalWithInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                        </span>
                      </span>
                    ) : (
                      <span className="ml-2 font-bold text-blue-700">₹{interestCalculation.totalWithInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
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
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {isSaving ? (
            <>
              <ButtonLoader />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save
            </>
          )}
        </button>
      </div>
    </form>
  );
}
