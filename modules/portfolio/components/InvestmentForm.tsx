'use client';

import { useState, useMemo, useEffect } from 'react';
import { Investment } from '@/core/types';
import { Save, X, Sparkles } from 'lucide-react';
import { ButtonLoader } from '@/shared/components/Loader';
import { convertToINR, convertFromINR, getConversionRateText, getCurrencySymbol, type Currency } from '@/core/services/currencyService';

interface InvestmentFormProps {
  investment?: Investment;
  onSave: (investment: Investment) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function InvestmentForm({
  investment,
  onSave,
  onCancel,
  isSaving = false,
}: InvestmentFormProps) {
  // Determine initial currency
  const initialCurrency = (investment?.originalCurrency || investment?.currency || 'INR') as Currency;
  const initialAmount = investment?.originalAmount ?? (initialCurrency === 'INR' ? (investment?.amount ?? 0) : (investment?.amount ?? 0));

  // Determine initial maturity amount - use originalMaturityAmount if available, otherwise maturityAmount
  const initialMaturityAmount = investment?.originalMaturityAmount ?? investment?.maturityAmount ?? undefined;

  const [formData, setFormData] = useState<Partial<Investment>>(
    investment
      ? {
          ...investment,
          currency: initialCurrency,
          originalAmount: initialAmount,
          originalCurrency: initialCurrency,
          originalMaturityAmount: initialMaturityAmount,
          startDate: investment.startDate.split('T')[0],
          maturityDate: investment.maturityDate
            ? investment.maturityDate.split('T')[0]
            : undefined,
          endDate: investment.endDate
            ? investment.endDate.split('T')[0]
            : undefined,
          // Ensure ruleLabel and ruleFormula are preserved
          ruleLabel: investment.ruleLabel,
          ruleFormula: investment.ruleFormula,
        }
      : {
          name: '',
          amount: 0,
          currency: 'INR',
          originalAmount: 0,
          originalCurrency: 'INR',
          type: 'ppf',
          startDate: new Date().toISOString().split('T')[0],
          status: 'active',
        }
  );

  const selectedCurrency = (formData.currency || 'INR') as Currency;
  const inputAmount = formData.originalAmount ?? formData.amount ?? 0;
  const inputMaturityAmount = formData.originalMaturityAmount ?? formData.maturityAmount ?? undefined;

  // Calculate INR converted value for principal amount
  const inrConvertedValue = useMemo(() => {
    if (selectedCurrency === 'INR') {
      return inputAmount;
    }
    return convertToINR(inputAmount, selectedCurrency);
  }, [inputAmount, selectedCurrency]);

  // Calculate INR converted value for maturity amount
  const inrConvertedMaturityValue = useMemo(() => {
    if (inputMaturityAmount === undefined) return undefined;
    if (selectedCurrency === 'INR') {
      return inputMaturityAmount;
    }
    return convertToINR(inputMaturityAmount, selectedCurrency);
  }, [inputMaturityAmount, selectedCurrency]);

  // Get conversion rate text for tooltip
  const conversionRateText = useMemo(() => {
    if (selectedCurrency === 'INR') {
      return null;
    }
    return getConversionRateText(selectedCurrency, 'INR');
  }, [selectedCurrency]);

  const [isGeneratingFormula, setIsGeneratingFormula] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Add a timer to update calculated value periodically (for real-time updates based on current date)
  useEffect(() => {
    if (formData.ruleFormula && formData.startDate) {
      // Update every minute to reflect current date changes
      const interval = setInterval(() => {
        // Trigger recalculation by updating trigger
        // The useMemo will recalculate with new Date() automatically
        setUpdateTrigger(prev => prev + 1);
      }, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [formData.ruleFormula, formData.startDate]);

  const handleGenerateFormula = async () => {
    if (!formData.ruleLabel) {
      alert('Please enter a rule label first (e.g., "5x in 12 Years")');
      return;
    }

    setIsGeneratingFormula(true);
    try {
      const response = await fetch('/api/investments/generate-formula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleLabel: formData.ruleLabel }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate formula');
      }

      if (data.formula) {
        setFormData({ ...formData, ruleFormula: data.formula });
      } else {
        alert('Could not generate formula. Please try again or enter the formula manually.');
      }
    } catch (error: any) {
      console.error('Error generating formula:', error);
      alert(`Error generating formula: ${error.message || 'Please check your AI service configuration or enter the formula manually.'}`);
    } finally {
      setIsGeneratingFormula(false);
    }
  };

  // Helper function to calculate value from formula
  const calculateFromFormula = (targetDate: Date, principal: number, ruleFormula: string, startDate: string): number | null => {
    if (!ruleFormula || !startDate) {
      return null;
    }

    try {
      const start = new Date(startDate);
      const daysElapsed = Math.max(0, Math.floor((targetDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const yearsElapsed = daysElapsed / 365;
      const monthsElapsed = daysElapsed / 30;

      // Additional safety check - ensure formula doesn't contain dangerous patterns
      const dangerousPatterns = [
        /eval\s*\(/i,
        /function\s*\(/i,
        /require\s*\(/i,
        /import\s+/i,
        /process\./i,
        /global\./i,
        /window\./i,
        /document\./i,
      ];

      const hasDangerousPattern = dangerousPatterns.some(pattern => pattern.test(ruleFormula));
      if (hasDangerousPattern) {
        console.error('Formula contains dangerous patterns');
        return null;
      }

      // Create a safe evaluation context
      const context = {
        principal,
        amount: principal,
        daysElapsed,
        yearsElapsed,
        monthsElapsed,
        Math: {
          pow: Math.pow,
          exp: Math.exp,
          log: Math.log,
          sqrt: Math.sqrt,
          abs: Math.abs,
          round: Math.round,
          floor: Math.floor,
          ceil: Math.ceil,
          min: Math.min,
          max: Math.max,
          PI: Math.PI,
          E: Math.E,
        },
      };

      // Evaluate the formula safely
      const func = new Function(...Object.keys(context), `return ${ruleFormula}`);
      const result = func(...Object.values(context));

      // Ensure result is a valid number
      if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) {
        console.error('Formula returned invalid result:', result);
        return null;
      }

      return result; // Returns in INR
    } catch (error) {
      console.error('Error calculating value from formula:', error);
      return null;
    }
  };

  // Calculate current value based on formula if rule exists
  const calculatedValue = useMemo(() => {
    if (!formData.ruleFormula || !formData.startDate) return null;
    
    const currentDate = new Date();
    const result = calculateFromFormula(currentDate, inrConvertedValue, formData.ruleFormula, formData.startDate);
    
    if (result === null) return null;

    // Convert back to original currency if not INR
    if (selectedCurrency !== 'INR') {
      return convertFromINR(result, selectedCurrency);
    }
    return result;
  }, [formData.ruleFormula, formData.startDate, inrConvertedValue, selectedCurrency, updateTrigger]);

  // Calculate expected maturity value
  const expectedMaturityValue = useMemo(() => {
    // If maturity amount is provided, use that (manually entered)
    if (inputMaturityAmount !== undefined) {
      return {
        original: inputMaturityAmount,
        inr: inrConvertedMaturityValue || inputMaturityAmount,
        isCalculated: false,
        calculationMethod: 'manual' as const,
      };
    }

    // If maturity date and formula exist, calculate from formula
    if (formData.maturityDate && formData.ruleFormula && formData.startDate) {
      const maturityDate = new Date(formData.maturityDate);
      const result = calculateFromFormula(maturityDate, inrConvertedValue, formData.ruleFormula, formData.startDate);
      
      if (result !== null) {
        return {
          original: selectedCurrency !== 'INR' ? convertFromINR(result, selectedCurrency) : result,
          inr: result,
          isCalculated: true,
          calculationMethod: 'formula' as const,
        };
      }
    }

    return null;
  }, [inputMaturityAmount, inrConvertedMaturityValue, formData.maturityDate, formData.ruleFormula, formData.startDate, inrConvertedValue, selectedCurrency, updateTrigger]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currency = (formData.currency || 'INR') as Currency;
    // Use inputAmount directly to preserve precision (it comes from the input field)
    const originalAmount = formData.originalAmount ?? inputAmount;
    
    // Determine maturity amount: use manually entered value, or calculated value, or undefined
    const originalMaturityAmount = formData.originalMaturityAmount ?? (expectedMaturityValue ? expectedMaturityValue.original : undefined);
    
    // Always store amount in INR for calculations
    // Round to 2 decimal places to avoid floating point precision issues
    const amountInINR = currency === 'INR' 
      ? Math.round(originalAmount * 100) / 100 
      : Math.round(convertToINR(originalAmount, currency) * 100) / 100;
    
    // Always store maturity amount in INR for calculations (if provided or calculated)
    const maturityAmountInINR = originalMaturityAmount !== undefined
      ? (currency === 'INR' 
          ? Math.round(originalMaturityAmount * 100) / 100
          : Math.round(convertToINR(originalMaturityAmount, currency) * 100) / 100)
      : (expectedMaturityValue ? Math.round(expectedMaturityValue.inr * 100) / 100 : undefined);

    const investmentData: Investment = {
      id: investment?.id || `inv-${Date.now()}`,
      name: formData.name || '',
      amount: amountInINR, // Always in INR
      currency: currency,
      originalAmount: originalAmount,
      originalCurrency: currency,
      type: formData.type || 'ppf',
      startDate: formData.startDate || new Date().toISOString(),
      endDate: formData.endDate,
      maturityDate: formData.maturityDate,
      maturityAmount: maturityAmountInINR, // Always in INR
      originalMaturityAmount: originalMaturityAmount,
      interestRate: formData.interestRate,
      ruleLabel: formData.ruleLabel,
      ruleFormula: formData.ruleFormula,
      description: formData.description,
      status: formData.status || 'active',
      isPublished: investment?.isPublished ?? true, // Preserve existing or default to true for new items
      createdAt: investment?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(investmentData);
  };

  const handleCurrencyChange = (newCurrency: Currency) => {
    const currentAmount = formData.originalAmount ?? formData.amount ?? 0;
    setFormData({
      ...formData,
      currency: newCurrency,
      originalCurrency: newCurrency,
      originalAmount: currentAmount,
    });
  };

  const handleAmountChange = (value: string) => {
    // Preserve precision by using the string value directly, then parse
    // This avoids floating point precision issues
    const numValue = value === '' ? 0 : parseFloat(value);
    setFormData({
      ...formData,
      originalAmount: isNaN(numValue) ? 0 : numValue,
    });
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
                type: e.target.value as Investment['type'],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
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
            Amount ({getCurrencySymbol(selectedCurrency)}) *
          </label>
          <div className="relative">
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={inputAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-20"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
          <select
            required
            value={selectedCurrency}
            onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="INR">INR (Indian Rupee)</option>
            <option value="NPR">NPR (Nepalese Rupee)</option>
            <option value="USD">USD (US Dollar)</option>
          </select>
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
            value={formData.maturityDate || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                maturityDate: e.target.value || undefined,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {formData.maturityDate && expectedMaturityValue && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maturity Amount ({getCurrencySymbol(selectedCurrency)})
              {expectedMaturityValue.isCalculated && (
                <span className="text-xs text-gray-500 font-normal ml-2">
                  (Calculated from formula)
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={inputMaturityAmount !== undefined ? inputMaturityAmount : expectedMaturityValue.original}
                onChange={(e) => {
                  const value = e.target.value ? parseFloat(e.target.value) : undefined;
                  setFormData({
                    ...formData,
                    originalMaturityAmount: value,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-20"
                placeholder="0.00"
              />
              {(inputMaturityAmount !== undefined || expectedMaturityValue) && selectedCurrency !== 'INR' && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200 whitespace-nowrap">
                  ≈ ₹{(inrConvertedMaturityValue ?? expectedMaturityValue.inr).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>
            {selectedCurrency !== 'INR' && (
              <p className="text-xs text-gray-500 mt-1" title={conversionRateText || undefined}>
                {conversionRateText}
              </p>
            )}
            {expectedMaturityValue.isCalculated && (
              <p className="text-xs text-blue-600 mt-1">
                💡 Auto-calculated. You can override by entering a different value.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date (Optional)
          </label>
          <input
            type="date"
            value={formData.endDate || ''}
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
            value={formData.interestRate || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                interestRate: e.target.value
                  ? parseFloat(e.target.value)
                  : undefined,
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
                status: e.target.value as Investment['status'],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="active">Active</option>
            <option value="matured">Matured</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rule Label (Optional)
          </label>
          <input
            type="text"
            value={formData.ruleLabel || ''}
            onChange={(e) =>
              setFormData({ ...formData, ruleLabel: e.target.value })
            }
            placeholder="e.g., 5x in 12 Years"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rule Formula (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.ruleFormula || ''}
              onChange={(e) =>
                setFormData({ ...formData, ruleFormula: e.target.value })
              }
              placeholder="e.g., principal * Math.pow(5, (yearsElapsed / 12))"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleGenerateFormula}
              disabled={isGeneratingFormula || !formData.ruleLabel}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Generate formula using AI">
              {isGeneratingFormula ? (
                <>
                  <ButtonLoader />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Available variables: principal, amount, daysElapsed, yearsElapsed, monthsElapsed
          </p>
        </div>
      </div>

      {/* Display calculated value if rule formula exists - Always show if formula exists */}
      {formData.ruleFormula && formData.startDate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">Calculated Current Value</p>
              {calculatedValue !== null ? (
                <p className="text-lg font-bold text-blue-700 mt-1">
                  {selectedCurrency !== 'INR' ? (
                    <>
                      {getCurrencySymbol(selectedCurrency)}{calculatedValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                      <span className="text-xs text-gray-500 ml-1">
                        (₹{convertToINR(calculatedValue, selectedCurrency).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </span>
                    </>
                  ) : (
                    <>₹{calculatedValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                  )}
                </p>
              ) : (
                <p className="text-sm text-red-600 mt-1">Error calculating value. Please check your formula.</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Updates automatically based on current date and formula
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Display expected maturity value - Always show if maturity date or maturity amount exists */}
      {(formData.maturityDate || inputMaturityAmount !== undefined) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">
                {formData.maturityDate ? 'Expected Maturity Value (at Maturity Date)' : 'Expected Maturity Value'}
              </p>
              {expectedMaturityValue !== null ? (
                <p className="text-lg font-bold text-green-700 mt-1">
                  {selectedCurrency !== 'INR' ? (
                    <>
                      {getCurrencySymbol(selectedCurrency)}{expectedMaturityValue.original.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                      <span className="text-xs text-gray-500 ml-1">
                        (₹{expectedMaturityValue.inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </span>
                    </>
                  ) : (
                    <>₹{expectedMaturityValue.inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                  )}
                </p>
              ) : formData.maturityDate && formData.ruleFormula ? (
                <p className="text-sm text-gray-600 mt-1">Calculating from formula...</p>
              ) : (
                <p className="text-sm text-gray-600 mt-1">Enter maturity amount or ensure formula is set</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description (Optional)
        </label>
        <textarea
          value={formData.description || ''}
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
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
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
              Save Investment
            </>
          )}
        </button>
      </div>
    </form>
  );
}
