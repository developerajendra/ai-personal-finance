'use client';

import { useState } from 'react';
import type { Investment } from '@/shared/types';
import type { RETIREMENT_INVESTMENT_TYPES } from '@/shared/schemas/finance';
import { Save, X } from 'lucide-react';
import { ButtonLoader } from '@/shared/components/Loader';

export type RetirementType = (typeof RETIREMENT_INVESTMENT_TYPES)[number];

/** Account types offered on the retirement page, in dropdown order. */
export const RETIREMENT_TYPE_OPTIONS: { value: RetirementType; label: string; defaultName: string; notes: string }[] = [
  { value: 'nps', label: 'NPS', defaultName: 'NPS Tier I', notes: 'PRAN, fund manager, scheme choice…' },
  { value: 'epf', label: 'PF', defaultName: 'Provident fund', notes: 'UAN, employer, member ID…' },
  { value: 'retirement-other', label: 'Other', defaultName: '', notes: 'Scheme, provider, account number…' },
];

export const retirementTypeLabel = (type: string) => RETIREMENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? 'Other';

const formulaFor = (rate: number) => `principal * Math.pow(1 + ${rate} / 100, yearsElapsed)`;
const labelFor = (rate: number) => `${rate}% p.a. expected, compounded yearly`;
const today = () => new Date().toISOString().split('T')[0];

const field = 'w-full px-3 py-2 border border-divider rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-[var(--input-bg)]';
const labelCls = 'block text-sm font-medium text-neutral-800 mb-1';

/**
 * Add / edit a manually tracked retirement account (NPS, PF or other), stored as an investment
 * of type "nps", "epf" or "retirement-other". The balance is entered from the latest statement;
 * an optional expected return makes the value grow yearly from the as-of date.
 */
export function RetirementAccountForm({
  investment,
  onSave,
  onCancel,
  isSaving = false,
}: {
  investment?: Investment;
  onSave: (investment: Investment) => void;
  onCancel: () => void;
  isSaving?: boolean;
}) {
  const initialType = (RETIREMENT_TYPE_OPTIONS.find((o) => o.value === investment?.type)?.value ?? 'nps') as RetirementType;
  const [type, setType] = useState<RetirementType>(initialType);
  const [name, setName] = useState(investment?.name ?? RETIREMENT_TYPE_OPTIONS[0].defaultName);
  const [amount, setAmount] = useState(investment ? String(investment.amount) : '');
  const [startDate, setStartDate] = useState(investment?.startDate?.split('T')[0] ?? today());
  const [rate, setRate] = useState(investment?.interestRate != null ? String(investment.interestRate) : '');
  const [description, setDescription] = useState(investment?.description ?? '');
  const [status, setStatus] = useState<Investment['status']>(investment?.status ?? 'active');
  const option = RETIREMENT_TYPE_OPTIONS.find((o) => o.value === type)!;

  const changeType = (next: RetirementType) => {
    // Swap the suggested name along with the type, unless the user typed their own
    const isDefaultName = !name.trim() || RETIREMENT_TYPE_OPTIONS.some((o) => o.defaultName === name);
    if (isDefaultName) setName(RETIREMENT_TYPE_OPTIONS.find((o) => o.value === next)!.defaultName);
    setType(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(amount) || 0;
    const r = rate.trim() === '' ? undefined : parseFloat(rate);
    // Keep a hand-written growth rule when the rate wasn't touched; otherwise derive it from the rate
    const keepRule = investment && investment.interestRate === r && investment.ruleFormula;
    const now = new Date().toISOString();
    onSave({
      ...(investment ?? {}),
      id: investment?.id || `${type}-${Date.now()}`,
      name: name.trim() || option.label,
      type,
      amount: principal,
      currency: 'INR',
      originalAmount: principal,
      originalCurrency: 'INR',
      assetType: 'fixed',
      startDate,
      interestRate: r,
      ruleFormula: keepRule ? investment!.ruleFormula : r ? formulaFor(r) : undefined,
      ruleLabel: keepRule ? investment!.ruleLabel : r ? labelFor(r) : undefined,
      description: description.trim() || undefined,
      status,
      isPublished: investment?.isPublished ?? true,
      createdAt: investment?.createdAt || now,
      updatedAt: now,
    } as Investment);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Account type *</label>
          <select value={type} onChange={(e) => changeType(e.target.value as RetirementType)} className={field}>
            {RETIREMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Account name *</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder={option.defaultName || 'e.g. Superannuation'} className={field} />
        </div>

        <div>
          <label className={labelCls}>Current balance (₹) *</label>
          <input type="number" required min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
        </div>

        <div>
          <label className={labelCls}>Balance as of *</label>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} />
        </div>

        <div>
          <label className={labelCls}>Expected return (% p.a.)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="Optional"
            className={field}
          />
          <p className="mt-1 text-[12px] text-muted">
            {rate ? 'Value grows yearly from the as-of date.' : 'Value stays at the balance entered — update it from your statement.'}
          </p>
        </div>

        {investment && (
          <div>
            <label className={labelCls}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Investment['status'])} className={field}>
              <option value="active">Active</option>
              <option value="matured">Matured</option>
              <option value="closed">Closed (excluded from net worth)</option>
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={labelCls}>Notes</label>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={option.notes} className={field} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={isSaving} className="btn btn-secondary">
          <X className="h-4 w-4" />
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="btn btn-primary">
          {isSaving ? <ButtonLoader /> : <Save className="h-4 w-4" />}
          {investment ? 'Save changes' : 'Add account'}
        </button>
      </div>
    </form>
  );
}
