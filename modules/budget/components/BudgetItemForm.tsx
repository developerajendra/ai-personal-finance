'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import type { BudgetItem } from '@/shared/types';
import { BUDGET_EXPENSE_CATEGORIES, BUDGET_INCOME_CATEGORIES, type BudgetItemInput } from '@/shared/schemas/finance';
import { Segmented } from '@/shared/components/ui';
import { ButtonLoader } from '@/shared/components/Loader';
import { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';
import { EXPENSE_PRESETS, MONTHS_SHORT } from '../useBudget';

const field = 'w-full px-3 py-2 border border-divider rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-[var(--input-bg)]';
const labelCls = 'block text-sm font-medium text-neutral-800 mb-1';

/** Add / edit a budget line — an expense (fixed bill or variable spend) or an income, monthly or yearly. */
export function BudgetItemForm({
  kind,
  item,
  onSave,
  onCancel,
  isSaving = false,
  error,
}: {
  kind: BudgetItem['kind'];
  item?: BudgetItem;
  onSave: (input: BudgetItemInput & Record<string, unknown>) => void;
  onCancel: () => void;
  isSaving?: boolean;
  error?: string;
}) {
  const t = usePortfolioTotals();
  const income = kind === 'income';
  const categories: readonly string[] = income ? BUDGET_INCOME_CATEGORIES : BUDGET_EXPENSE_CATEGORIES;

  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? (income ? 'Salary' : 'Home'));
  const [costType, setCostType] = useState<BudgetItem['costType']>(item?.costType ?? 'fixed');
  const [frequency, setFrequency] = useState<BudgetItem['frequency']>(item?.frequency ?? 'monthly');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [dueDay, setDueDay] = useState(item?.dueDay ? String(item.dueDay) : '');
  const [dueMonth, setDueMonth] = useState(item?.dueMonth ? String(item.dueMonth) : String(new Date().getMonth() + 1));
  const [paidFrom, setPaidFrom] = useState(item?.paidFrom ?? '');
  const [loanId, setLoanId] = useState(item?.loanId ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [active, setActive] = useState(item?.active ?? true);

  const accounts = Array.from(new Set(t.cashAccounts.map((b) => `${b.bankName}${b.accountNumber ? ` ••${b.accountNumber.slice(-4)}` : ''}`)));
  const loans = t.activeLoans;

  const applyPreset = ([n, c, ct, f, d]: (typeof EXPENSE_PRESETS)[number]) => {
    setName(n);
    setCategory(c);
    setCostType(ct);
    setFrequency(f);
    setDueDay(d ? String(d) : '');
  };
  const pickLoan = (id: string) => {
    setLoanId(id);
    const loan = loans.find((l) => l.id === id);
    if (!loan) return;
    // An EMI is a fixed monthly bill: prefill from the loan, keeping anything already typed
    setName((n) => n || `${loan.name} EMI`);
    setAmount((a) => a || String(loan.emiAmount));
    setDueDay((d) => d || String(loan.emiDate));
    setCostType('fixed');
    setFrequency('monthly');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      kind,
      name: name.trim(),
      category: category as BudgetItemInput['category'],
      costType,
      frequency,
      amount,
      // Blank values clear the field on an edit
      dueDay: dueDay || '',
      dueMonth: frequency === 'yearly' ? dueMonth : '',
      paidFrom: paidFrom.trim(),
      loanId: income ? '' : loanId,
      notes: notes.trim(),
      active,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-loss-bg p-3 text-[13.5px] text-loss">{error}</p>}

      {!income && !item && (
        <div>
          <span className={labelCls}>Quick add</span>
          <div className="flex flex-wrap gap-1.5">
            {EXPENSE_PRESETS.map((p) => (
              <button key={p[0]} type="button" onClick={() => applyPreset(p)} className="tag tag-neutral !px-3 !py-1.5 hover:bg-tile">
                {p[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="bud-name">{income ? 'Income source' : 'Expense'} *</label>
          <input
            id="bud-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={income ? 'e.g. Salary — TTN' : 'e.g. Electricity bill'}
            className={field}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="bud-cat">Category</label>
          <select id="bud-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelCls}>Type</span>
          <Segmented<BudgetItem['costType']>
            ariaLabel="Type"
            value={costType}
            onChange={setCostType}
            options={[
              { value: 'fixed', label: income ? 'Fixed amount' : 'Fixed bill' },
              { value: 'variable', label: income ? 'Varies' : 'Spend limit' },
            ]}
          />
          <p className="mt-1 text-[12px] text-muted">
            {costType === 'fixed' ? (income ? 'Mark it received once a month or year.' : 'Paid once — mark it paid.') : income ? 'Log each amount as it comes in.' : 'Log spends against a cap.'}
          </p>
        </div>

        <div>
          <span className={labelCls}>Repeats</span>
          <Segmented<BudgetItem['frequency']>
            ariaLabel="Repeats"
            value={frequency}
            onChange={setFrequency}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="bud-amount">{frequency === 'yearly' ? 'Amount per year (₹)' : 'Amount per month (₹)'} *</label>
          <input id="bud-amount" type="number" required min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
          {frequency === 'yearly' && Number(amount) > 0 && (
            <p className="mt-1 text-[12px] text-muted">≈ ₹{Math.round(Number(amount) / 12).toLocaleString('en-IN')} a month to set aside</p>
          )}
        </div>

        {frequency === 'yearly' && (
          <div>
            <label className={labelCls} htmlFor="bud-month">Due in</label>
            <select id="bud-month" value={dueMonth} onChange={(e) => setDueMonth(e.target.value)} className={field}>
              {MONTHS_SHORT.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls} htmlFor="bud-day">{income ? 'Credited on day' : 'Due on day'}</label>
          <input
            id="bud-day"
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            placeholder="Any time"
            className={field}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="bud-acct">{income ? 'Credited to' : 'Paid from'}</label>
          <input id="bud-acct" list="bud-accounts" value={paidFrom} onChange={(e) => setPaidFrom(e.target.value)} placeholder="Bank account or card" className={field} />
          <datalist id="bud-accounts">
            {accounts.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>

        {!income && loans.length > 0 && (
          <div>
            <label className={labelCls} htmlFor="bud-loan">Repays a loan</label>
            <select id="bud-loan" value={loanId} onChange={(e) => pickLoan(e.target.value)} className={field}>
              <option value="">No</option>
              {loans.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        {item && (
          <label className="flex items-center gap-2 self-end pb-2 text-[14px]">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active — include in the budget
          </label>
        )}

        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="bud-notes">Notes</label>
          <textarea id="bud-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={isSaving} className="btn btn-secondary">
          <X className="h-4 w-4" />
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="btn btn-primary">
          {isSaving ? <ButtonLoader /> : <Save className="h-4 w-4" />}
          {item ? 'Save changes' : income ? 'Add income' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}
