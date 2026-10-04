'use client';

import { useState } from 'react';
import type { Investment } from '@/shared/types';
import { Save, X } from 'lucide-react';
import { ButtonLoader } from '@/shared/components/Loader';

const formulaFor = (rate: number) => `principal * Math.pow(1 + ${rate} / 100, yearsElapsed)`;
const labelFor = (rate: number) => `${rate}% p.a. expected, compounded yearly`;
const today = () => new Date().toISOString().split('T')[0];

const field = 'w-full px-3 py-2 border border-divider rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-[var(--input-bg)]';
const labelCls = 'block text-sm font-medium text-neutral-800 mb-1';

/**
 * Add / edit an NPS account, stored as an investment of type "nps". NPS is market-linked,
 * so the balance is entered from the latest statement; an optional expected return makes
 * the value grow yearly from the as-of date.
 */
export function NpsForm({
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
  const [name, setName] = useState(investment?.name ?? 'NPS Tier I');
  const [amount, setAmount] = useState(investment ? String(investment.amount) : '');
  const [startDate, setStartDate] = useState(investment?.startDate?.split('T')[0] ?? today());
  const [rate, setRate] = useState(investment?.interestRate != null ? String(investment.interestRate) : '');
  const [description, setDescription] = useState(investment?.description ?? '');
  const [status, setStatus] = useState<Investment['status']>(investment?.status ?? 'active');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(amount) || 0;
    const r = rate.trim() === '' ? undefined : parseFloat(rate);
    // Keep a hand-written growth rule when the rate wasn't touched; otherwise derive it from the rate
    const keepRule = investment && investment.interestRate === r && investment.ruleFormula;
    const now = new Date().toISOString();
    onSave({
      ...(investment ?? {}),
      id: investment?.id || `nps-${Date.now()}`,
      name: name.trim() || 'NPS',
      type: 'nps',
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
        <div className="sm:col-span-2">
          <label className={labelCls}>Account name *</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NPS Tier I" className={field} />
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
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="PRAN, fund manager, scheme choice…" className={field} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={isSaving} className="btn btn-secondary">
          <X className="h-4 w-4" />
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="btn btn-primary">
          {isSaving ? <ButtonLoader /> : <Save className="h-4 w-4" />}
          {investment ? 'Save changes' : 'Add NPS account'}
        </button>
      </div>
    </form>
  );
}
