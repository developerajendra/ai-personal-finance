'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import type { Subscription } from '@/shared/types';
import { Button } from '@/shared/components/ui';
import { PRESETS, useSubscriptions } from '../useSubscriptions';

type Form = {
  name: string;
  plan: string;
  amount: string;
  currency: Subscription['currency'];
  cycle: Subscription['cycle'];
  nextDate: string;
  ends: 'renew' | 'end';
  category: Subscription['category'];
  status: Subscription['status'];
  paidWith: string;
  notes: string;
  remind: boolean;
  color?: string;
  monogram?: string;
};

const inMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

const empty = (): Form => ({
  name: '',
  plan: '',
  amount: '',
  currency: 'USD',
  cycle: 'Monthly',
  nextDate: inMonth(),
  ends: 'renew',
  category: 'AI tools',
  status: 'Active',
  paidWith: '',
  notes: '',
  remind: true,
});

const fromSub = (s: Subscription): Form => ({
  name: s.name,
  plan: s.plan ?? '',
  amount: String(s.amount),
  currency: s.currency,
  cycle: s.cycle,
  nextDate: s.nextDate,
  ends: s.ends ? 'end' : 'renew',
  category: s.category,
  status: s.status,
  paidWith: s.paidWith ?? '',
  notes: s.notes ?? '',
  remind: s.remind,
  color: s.color,
  monogram: s.monogram,
});

/** Add / edit subscription dialog (design: "Both open the same add / edit form"). */
export function SubscriptionForm({ open, editing, onClose }: { open: boolean; editing: Subscription | null; onClose: () => void }) {
  const { create, update, remove } = useSubscriptions();
  const [f, setF] = useState<Form>(empty);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setF(editing ? fromSub(editing) : empty());
      setErr('');
    }
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const busy = create.isPending || update.isPending || remove.isPending;

  const save = async () => {
    const amount = parseFloat(f.amount);
    if (!f.name.trim()) return setErr('Enter a name.');
    if (!(amount > 0)) return setErr('Enter an amount above 0.');
    if (!f.nextDate) return setErr('Choose the renewal or end date.');
    const payload = {
      name: f.name.trim(),
      plan: f.plan,
      amount,
      currency: f.currency,
      cycle: f.cycle,
      nextDate: f.nextDate,
      ends: f.ends === 'end',
      category: f.category,
      status: f.status,
      paidWith: f.paidWith,
      notes: f.notes,
      remind: f.remind,
      color: f.color,
      monogram: f.monogram,
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, patch: payload });
      else await create.mutateAsync(payload);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  const del = async () => {
    if (!editing || !confirm(`Delete ${editing.name}? This can't be undone.`)) return;
    try {
      await remove.mutateAsync(editing.id);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not delete.');
    }
  };

  const label = 'field-label';
  // Portalled to <body>: the page column animates with a transform, which would otherwise
  // trap this fixed overlay inside it instead of covering the viewport.
  return createPortal(
    <div
      className="fade-in fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto px-4 py-[6vh]"
      style={{ background: 'rgba(29, 29, 31, 0.4)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="sub-form-title" className="dialog pop-in w-full max-w-[540px] p-[22px] [transform-origin:top_center]">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="sub-form-title" className="text-[19px]">
            {editing ? 'Edit subscription' : 'Add subscription'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-accent-700 hover:bg-accent-100">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {!editing && (
          <div className="mb-4">
            <span className={label}>Quick fill</span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(([name, plan, category, amount, currency, color, mono]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setF((x) => ({ ...x, name, plan, category, amount: String(amount), currency, color, monogram: mono }))}
                  className="flex items-center gap-1.5 rounded-full border border-divider bg-panel py-1 pl-1.5 pr-3 text-[13.5px] transition-colors hover:border-accent hover:bg-accent-100">
                  <span className="grid h-[18px] min-w-[18px] place-items-center rounded-[5px] px-0.5 text-[9px] font-bold text-white" style={{ background: color }}>
                    {mono}
                  </span>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={label}>Service</span>
            <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Claude" autoFocus />
          </label>
          <label>
            <span className={label}>Plan</span>
            <input className="input" value={f.plan} onChange={(e) => set('plan', e.target.value)} placeholder="e.g. Pro" />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-[1.2fr_1fr_1fr] gap-3">
          <label>
            <span className={label}>Amount</span>
            <input className="input tabular-nums" inputMode="decimal" value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
          </label>
          <label>
            <span className={label}>Currency</span>
            <select className="input" value={f.currency} onChange={(e) => set('currency', e.target.value as Form['currency'])}>
              <option>USD</option>
              <option>INR</option>
              <option>NPR</option>
            </select>
          </label>
          <label>
            <span className={label}>Billing</span>
            <select className="input" value={f.cycle} onChange={(e) => set('cycle', e.target.value as Form['cycle'])}>
              <option>Monthly</option>
              <option>Yearly</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label>
            <span className={label}>Renewal or end date</span>
            <input type="date" className="input" value={f.nextDate} onChange={(e) => set('nextDate', e.target.value)} />
          </label>
          <label>
            <span className={label}>On that date</span>
            <select className="input" value={f.ends} onChange={(e) => set('ends', e.target.value as Form['ends'])}>
              <option value="renew">Renews automatically</option>
              <option value="end">Ends · won’t renew</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label>
            <span className={label}>Category</span>
            <select className="input" value={f.category} onChange={(e) => set('category', e.target.value as Form['category'])}>
              <option>AI tools</option>
              <option>Entertainment</option>
              <option>Cloud &amp; storage</option>
              <option>Other</option>
            </select>
          </label>
          <label>
            <span className={label}>Status</span>
            <select className="input" value={f.status} onChange={(e) => set('status', e.target.value as Form['status'])}>
              <option>Active</option>
              <option>Cancelled</option>
            </select>
          </label>
        </div>

        <label className="mt-3 block">
          <span className={label}>Paid with</span>
          <input className="input" value={f.paidWith} onChange={(e) => set('paidWith', e.target.value)} placeholder="e.g. HDFC Credit Card ••3391" />
        </label>
        <label className="mt-3 block">
          <span className={label}>Notes</span>
          <textarea className="input min-h-[84px] resize-y" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Account email, team seat, cancel link…" />
        </label>

        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[14px]">
          <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--color-accent)]" checked={f.remind} onChange={(e) => set('remind', e.target.checked)} />
          Remind me 3 days before the date
        </label>

        {err && (
          <p className="mt-3 text-[13px] text-loss" role="alert">
            {err}
          </p>
        )}

        <div className="mt-5 flex items-center gap-2">
          {editing && (
            <Button variant="danger" icon={Trash2} onClick={del} disabled={busy}>
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save subscription'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
