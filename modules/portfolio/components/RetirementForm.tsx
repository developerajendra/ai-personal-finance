'use client';

import { useState } from 'react';
import type { Investment } from '@/shared/types';
import { Save, X } from 'lucide-react';
import { ButtonLoader } from '@/shared/components/Loader';

export type RetirementType = 'ppf' | 'epf' | 'nps' | 'retirement-other';

export const RETIREMENT_SCHEMES: { value: RetirementType; label: string; short: string; hint: string; rate?: number; years?: number }[] = [
  { value: 'ppf', label: 'PPF — Public Provident Fund', short: 'PPF', hint: '15-year lock-in; government-set rate, compounded yearly.', rate: 7.1, years: 15 },
  { value: 'epf', label: 'EPF / PF — Employee or Voluntary PF', short: 'EPF / PF', hint: 'For PF not covered by an uploaded EPFO passbook (e.g. VPF, a trust PF).', rate: 8.25 },
  { value: 'nps', label: 'NPS — National Pension System', short: 'NPS', hint: 'Market-linked: leave the rate empty and update the balance from your statement.' },
  { value: 'retirement-other', label: 'Other — gratuity, superannuation, APY…', short: 'Other', hint: 'Any other retirement benefit or pension scheme.' },
];

export const schemeLabel = (t: string) => RETIREMENT_SCHEMES.find((s) => s.value === t)?.short ?? t;

const formulaFor = (rate: number) => `principal * Math.pow(1 + ${rate} / 100, yearsElapsed)`;
const labelFor = (rate: number) => `${rate}% p.a. compounded yearly`;
const addYears = (iso: string, years: number) => {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
};
const today = () => new Date().toISOString().split('T')[0];

const field = 'w-full px-3 py-2 border border-divider rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-[var(--input-bg)]';
const labelCls = 'block text-sm font-medium text-neutral-800 mb-1';

/**
 * Add / edit a manually tracked retirement account. Stored as an investment whose type is
 * one of the retirement schemes; an interest rate becomes a yearly-compounding growth rule.
 */
export function RetirementForm({
  investment,
  defaultType = 'ppf',
  onSave,
  onCancel,
  isSaving = false,
}: {
  investment?: Investment;
  defaultType?: RetirementType;
  onSave: (investment: Investment) => void;
  onCancel: () => void;
  isSaving?: boolean;
}) {
  const initialType = (investment?.type as RetirementType) || defaultType;
  const scheme = (t: RetirementType) => RETIREMENT_SCHEMES.find((s) => s.value === t)!;
  const [type, setType] = useState<RetirementType>(initialType);
  const [name, setName] = useState(investment?.name ?? '');
  const [amount, setAmount] = useState(String(investment?.amount ?? ''));
  const [startDate, setStartDate] = useState(investment?.startDate?.split('T')[0] ?? today());
  const [rate, setRate] = useState(
    investment ? (investment.interestRate != null ? String(investment.interestRate) : '') : String(scheme(initialType).rate ?? ''),
  );
  const [maturityDate, setMaturityDate] = useState(
    investment?.maturityDate?.split('T')[0] ?? (scheme(initialType).years ? addYears(today(), scheme(initialType).years!) : ''),
  );
  // A new record's maturity follows the scheme term until the user picks a date themselves
  const [maturityTouched, setMaturityTouched] = useState(!!investment);
  const [description, setDescription] = useState(investment?.description ?? '');
  const [status, setStatus] = useState<Investment['status']>(investment?.status ?? 'active');

  const changeType = (t: RetirementType) => {
    setType(t);
    // Only prefill defaults on a new record, so an edit never silently changes the growth rule
    if (!investment) {
      setRate(String(scheme(t).rate ?? ''));
      if (!maturityTouched) setMaturityDate(scheme(t).years ? addYears(startDate, scheme(t).years!) : '');
    }
  };
  const changeStart = (d: string) => {
    setStartDate(d);
    const years = scheme(type).years;
    if (!maturityTouched && years && d) setMaturityDate(addYears(d, years));
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
      id: investment?.id || `ret-${Date.now()}`,
      name: name.trim() || scheme(type).short,
      type,
      amount: principal,
      currency: 'INR',
      originalAmount: principal,
      originalCurrency: 'INR',
      assetType: 'fixed',
      startDate,
      maturityDate: maturityDate || undefined,
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
      <div>
        <label className={labelCls}>Scheme *</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Scheme">
          {RETIREMENT_SCHEMES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={type === s.value}
              onClick={() => changeType(s.value)}
              className={`rounded-lg border px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                type === s.value ? 'border-accent bg-accent-100 text-accent-800' : 'border-divider hover:bg-tile'
              }`}>
              {s.short}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted">{scheme(type).hint}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Account name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'ppf' ? 'e.g. PPF — SBI' : type === 'nps' ? 'e.g. NPS Tier I' : type === 'epf' ? 'e.g. VPF — Acme Corp' : 'e.g. Gratuity — Acme Corp'}
            className={field}
          />
        </div>

        <div>
          <label className={labelCls}>{type === 'nps' ? 'Current balance (₹) *' : 'Balance / amount invested (₹) *'}</label>
          <input type="number" required min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
        </div>

        <div>
          <label className={labelCls}>Balance as of *</label>
          <input type="date" required value={startDate} onChange={(e) => changeStart(e.target.value)} className={field} />
        </div>

        <div>
          <label className={labelCls}>Interest rate (% p.a.)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={type === 'nps' ? 'Market-linked' : 'Optional'}
            className={field}
          />
          <p className="mt-1 text-[12px] text-muted">{rate ? 'Value grows yearly from the as-of date.' : 'Value stays at the balance entered.'}</p>
        </div>

        <div>
          <label className={labelCls}>Maturity date</label>
          <input type="date" value={maturityDate} onChange={(e) => {
              setMaturityDate(e.target.value);
              setMaturityTouched(true);
            }} className={field} />
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
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Account number, branch, nominee…"
            className={field}
          />
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
