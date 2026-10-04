'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Edit2, Plus, Trash2 } from 'lucide-react';
import type { BudgetItem } from '@/shared/types';
import { BUDGET_EXPENSE_CATEGORIES, BUDGET_INCOME_CATEGORIES } from '@/shared/schemas/finance';
import { cn } from '@/shared/utils/cn';
import { Button, DetailRow, Drawer, EmptyState, PageHeader, Panel, PanelHeader, Skeleton, Tag } from '@/shared/components/ui';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';
import { DonutPanel } from '@/modules/portfolio/components/ClassCharts';
import { BudgetItemForm } from './BudgetItemForm';
import {
  MONTHS_SHORT,
  appliesIn,
  buildRow,
  categoryMeta,
  defaultEntryDate,
  monthKey,
  monthLabel,
  monthlyEquivalent,
  nextDueMonth,
  ordinal,
  shiftMonth,
  useBudget,
  type BudgetRow,
  type Tone,
} from '../useBudget';

const TONE_TEXT: Record<Tone, string> = {
  gain: 'text-gain',
  loss: 'text-loss',
  warn: 'text-warn',
  muted: 'text-muted',
  accent: 'text-accent-700',
};

type DrawerState =
  | { type: 'form'; kind: BudgetItem['kind']; item?: BudgetItem }
  | { type: 'detail'; id: string }
  | { type: 'log'; id: string }
  | null;

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

export function BudgetModule() {
  const { M } = useMoney();
  const t = usePortfolioTotals();
  const [month, setMonth] = useState(monthKey());
  const budget = useBudget(month);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [error, setError] = useState('');
  const isCurrent = month === monthKey();

  const { incomeRows, expenseRows, yearlyLater } = useMemo(() => {
    const rows = budget.items
      .filter((i) => appliesIn(i, month))
      .map((i) => buildRow(i, budget.entries.filter((e) => e.itemId === i.id), month, (n) => M(n)));
    return {
      incomeRows: rows.filter((r) => r.item.kind === 'income'),
      expenseRows: rows.filter((r) => r.item.kind === 'expense'),
      yearlyLater: budget.items.filter((i) => i.active && i.kind === 'expense' && i.frequency === 'yearly' && !appliesIn(i, month)),
    };
  }, [budget.items, budget.entries, month, M]);

  const sum = (rs: BudgetRow[], k: 'planned' | 'actual') => rs.reduce((s, r) => s + r[k], 0);
  const plannedOut = sum(expenseRows, 'planned');
  const spent = sum(expenseRows, 'actual');
  const plannedIn = sum(incomeRows, 'planned');
  const received = sum(incomeRows, 'actual');
  const setAside = budget.items.filter((i) => i.active && i.kind === 'expense' && i.frequency === 'yearly').reduce((s, i) => s + monthlyEquivalent(i), 0);
  const savings = plannedIn - plannedOut;
  const leftToPay = expenseRows.reduce((s, r) => s + Math.max(0, r.planned - r.actual), 0);

  const loanName = (id?: string) => (id ? t.loans.find((l) => l.id === id)?.name : undefined);
  const metaLine = (item: BudgetItem) =>
    [
      item.costType === 'fixed' ? 'Fixed' : item.kind === 'income' ? 'Varies' : 'Variable',
      item.frequency === 'yearly' ? `yearly · ${MONTHS_SHORT[(item.dueMonth ?? 1) - 1]}` : null,
      item.dueDay ? `${item.kind === 'income' ? 'on' : 'due'} ${ordinal(item.dueDay)}` : 'any time',
      loanName(item.loanId) ? `from ${loanName(item.loanId)}` : null,
      item.paidFrom,
    ]
      .filter(Boolean)
      .join(' · ');

  const run = async (fn: () => Promise<unknown>, after: DrawerState = null) => {
    setError('');
    try {
      await fn();
      setDrawer(after);
    } catch (e) {
      if (drawer) setError(errText(e));
      else alert(errText(e));
    }
  };
  const markDone = (r: BudgetRow) =>
    run(() => budget.addEntry.mutateAsync({ itemId: r.item.id, month, amount: r.planned - r.actual, date: defaultEntryDate(month, r.dueDate) }));
  const open = (d: DrawerState) => {
    setError('');
    setDrawer(d);
  };

  const drawerId = drawer && drawer.type !== 'form' ? drawer.id : undefined;
  const current = drawerId ? [...incomeRows, ...expenseRows].find((r) => r.item.id === drawerId) : undefined;
  const currentItem = drawer?.type === 'form' ? drawer.item : current?.item ?? (drawerId ? budget.items.find((i) => i.id === drawerId) : undefined);

  const byCategory = BUDGET_EXPENSE_CATEGORIES.map((c) => ({
    name: c,
    value: expenseRows.filter((r) => r.item.category === c).reduce((s, r) => s + r.planned, 0),
    color: categoryMeta(c).color,
  }));

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Planning' }, { label: 'Budget' }]}
        title={`Budget · ${monthLabel(month)}`}
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button variant="secondary" iconOnly icon={ChevronLeft} aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))} />
              <span className="min-w-[124px] text-center text-[14px] font-semibold">{monthLabel(month)}</span>
              <Button variant="secondary" iconOnly icon={ChevronRight} aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} />
              {!isCurrent && (
                <Button variant="ghost" size="sm" onClick={() => setMonth(monthKey())}>
                  This month
                </Button>
              )}
            </div>
            <Button variant="secondary" icon={Plus} onClick={() => open({ type: 'form', kind: 'income' })}>
              Add income
            </Button>
            <Button icon={Plus} onClick={() => open({ type: 'form', kind: 'expense' })}>
              Add expense
            </Button>
          </>
        }
        meta={false}
        hero={{
          value: M(plannedOut),
          metas: [
            { label: 'Income planned', value: M(plannedIn) },
            { label: 'Spent so far', value: M(spent) },
            { label: 'Left to pay', value: M(leftToPay), tone: leftToPay > 0 ? 'warn' : 'neutral' },
            { label: 'Expected savings', value: `${savings >= 0 ? '' : '−'}${M(Math.abs(savings))}`, tone: savings >= 0 ? 'gain' : 'loss' },
            ...(setAside > 0 ? [{ label: 'Yearly bills · per month', value: M(setAside) }] : []),
          ],
        }}
      />

      {budget.isLoading ? (
        <Skeleton className="h-[320px] w-full !rounded-panel" />
      ) : budget.items.length === 0 ? (
        <Panel>
          <EmptyState
            title="Plan your month"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" icon={Plus} onClick={() => open({ type: 'form', kind: 'income' })}>
                  Add income
                </Button>
                <Button icon={Plus} onClick={() => open({ type: 'form', kind: 'expense' })}>
                  Add expense
                </Button>
              </div>
            }>
            Add your salary and the bills you pay every month or year — rent, electricity, maintenance, mobile, school fees, health — then mark them paid or log spends as
            the month goes.
          </EmptyState>
        </Panel>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <DonutPanel title="Where it goes" subtitle={`Planned spending in ${monthLabel(month)}`} slices={byCategory} centreLabel="Planned" />
            <Panel className="h-full">
              <PanelHeader title="Month at a glance" subtitle={isCurrent ? 'So far this month' : monthLabel(month)} />
              <DetailRow label="Income received" value={`${M(received)} of ${M(plannedIn)}`} />
              <DetailRow
                label="Bills paid"
                value={`${expenseRows.filter((r) => r.item.costType === 'fixed' && r.done).length} of ${expenseRows.filter((r) => r.item.costType === 'fixed').length}`}
              />
              <DetailRow
                label="Spend limits used"
                value={`${M(sum(expenseRows.filter((r) => r.item.costType === 'variable'), 'actual'))} of ${M(sum(expenseRows.filter((r) => r.item.costType === 'variable'), 'planned'))}`}
              />
              <DetailRow label="Over budget" value={<span className={expenseRows.some((r) => r.tone === 'loss' && r.item.costType === 'variable') ? 'text-loss' : ''}>{expenseRows.filter((r) => r.item.costType === 'variable' && r.actual > r.planned).length} items</span>} />
              <div className="flex items-baseline justify-between pt-4">
                <span className="text-[15px] font-semibold">Left after bills</span>
                <span className={cn('text-[19px] font-bold tabular-nums', received - spent >= 0 ? 'text-ink' : 'text-loss')}>{M(received - spent)}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-muted">Income received minus what you have spent this month.</p>
            </Panel>
          </div>

          <BudgetTable
            heading="Income"
            rows={incomeRows}
            categories={BUDGET_INCOME_CATEGORIES}
            metaLine={metaLine}
            onOpen={(id) => open({ type: 'detail', id })}
            onDone={markDone}
            onLog={(id) => open({ type: 'log', id })}
            empty={
              <button type="button" onClick={() => open({ type: 'form', kind: 'income' })} className="text-accent-700 hover:underline">
                Add your salary or other income
              </button>
            }
            busy={budget.addEntry.isPending}
          />
          <BudgetTable
            heading="Expense"
            rows={expenseRows}
            categories={BUDGET_EXPENSE_CATEGORIES}
            metaLine={metaLine}
            onOpen={(id) => open({ type: 'detail', id })}
            onDone={markDone}
            onLog={(id) => open({ type: 'log', id })}
            empty={
              <button type="button" onClick={() => open({ type: 'form', kind: 'expense' })} className="text-accent-700 hover:underline">
                Add a monthly or yearly expense
              </button>
            }
            busy={budget.addEntry.isPending}
          />

          {yearlyLater.length > 0 && (
            <Panel>
              <PanelHeader title="Yearly bills" subtitle="Not due this month · set this much aside each month" />
              <ul className="divide-y divide-divider">
                {yearlyLater
                  .map((i) => ({ i, next: nextDueMonth(i, month) }))
                  .sort((a, b) => a.next.localeCompare(b.next))
                  .map(({ i, next }) => (
                    <li key={i.id}>
                      <button type="button" onClick={() => open({ type: 'detail', id: i.id })} className="flex w-full items-center gap-3 py-3 text-left">
                        <CategoryTile category={i.category} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{i.name}</span>
                          <span className="block text-[12.5px] text-muted">Due {monthLabel(next)}{i.dueDay ? ` · ${ordinal(i.dueDay)}` : ''}</span>
                        </span>
                        <span className="text-right">
                          <span className="block font-semibold tabular-nums">{M(i.amount)}</span>
                          <span className="block text-[12.5px] text-muted tabular-nums">{M(i.amount / 12)}/mo</span>
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      <Drawer
        open={!!drawer}
        onClose={() => open(null)}
        width={drawer?.type === 'form' ? 640 : 460}
        title={
          drawer?.type === 'form'
            ? drawer.item
              ? `Edit ${drawer.item.name}`
              : drawer.kind === 'income'
                ? 'Add income'
                : 'Add expense'
            : drawer?.type === 'log'
              ? currentItem?.kind === 'income'
                ? `Log income · ${currentItem?.name ?? ''}`
                : `Log spend · ${currentItem?.name ?? ''}`
              : currentItem?.name
        }
        subtitle={drawer?.type === 'form' ? undefined : currentItem ? `${currentItem.category} · ${monthLabel(month)}` : undefined}
        footer={
          drawer?.type === 'detail' && currentItem ? (
            <>
              <Button
                variant="danger"
                icon={Trash2}
                disabled={budget.removeItem.isPending}
                onClick={() => confirm(`Delete “${currentItem.name}” and all its logged payments?`) && run(() => budget.removeItem.mutateAsync(currentItem.id))}>
                Delete
              </Button>
              <Button variant="secondary" icon={Edit2} onClick={() => open({ type: 'form', kind: currentItem.kind, item: currentItem })}>
                Edit
              </Button>
              {current && (
                <Button icon={Plus} onClick={() => open({ type: 'log', id: currentItem.id })}>
                  {currentItem.kind === 'income' ? 'Log income' : 'Log payment'}
                </Button>
              )}
            </>
          ) : undefined
        }>
        {drawer?.type === 'form' && (
          <BudgetItemForm
            key={drawer.item?.id ?? `new-${drawer.kind}`}
            kind={drawer.kind}
            item={drawer.item}
            error={error}
            isSaving={budget.createItem.isPending || budget.updateItem.isPending}
            onCancel={() => open(drawer.item ? { type: 'detail', id: drawer.item.id } : null)}
            onSave={(input) =>
              run(
                () => (drawer.item ? budget.updateItem.mutateAsync({ id: drawer.item.id, patch: input }) : budget.createItem.mutateAsync(input)),
                drawer.item ? { type: 'detail', id: drawer.item.id } : null,
              )
            }
          />
        )}
        {drawer?.type === 'log' && currentItem && (
          <LogEntryForm
            key={currentItem.id}
            income={currentItem.kind === 'income'}
            suggested={current ? Math.max(0, current.planned - current.actual) : currentItem.amount}
            defaultDate={defaultEntryDate(month, current?.dueDate)}
            month={month}
            error={error}
            isSaving={budget.addEntry.isPending}
            onCancel={() => open({ type: 'detail', id: currentItem.id })}
            onSave={(v) => run(() => budget.addEntry.mutateAsync({ itemId: currentItem.id, month, ...v }), { type: 'detail', id: currentItem.id })}
          />
        )}
        {drawer?.type === 'detail' && currentItem && (
          <>
            {error && <p role="alert" className="mb-4 rounded-lg bg-loss-bg p-3 text-[13.5px] text-loss">{error}</p>}
            {current ? (
              <>
                <DetailRow label="Planned" value={M(current.planned)} />
                <DetailRow label={currentItem.kind === 'income' ? 'Received' : 'Actual'} value={<span className="font-semibold">{M(current.actual)}</span>} />
                <DetailRow label="Status" value={<span className={TONE_TEXT[current.tone]}>{current.status}</span>} />
              </>
            ) : (
              <DetailRow label="This month" value={currentItem.active ? `Not due — next ${monthLabel(nextDueMonth(currentItem, month))}` : 'Inactive'} />
            )}
            <DetailRow label="Details" value={metaLine(currentItem)} />
            {currentItem.frequency === 'yearly' && <DetailRow label="Per month to set aside" value={M(currentItem.amount / 12)} />}
            {currentItem.notes && <p className="mt-4 text-[14px] text-muted">{currentItem.notes}</p>}

            {current && (
              <div className="mt-6">
                <h3 className="mb-2 text-[15px] font-semibold">{currentItem.kind === 'income' ? 'Received' : 'Payments'} in {monthLabel(month)}</h3>
                {current.entries.length === 0 ? (
                  <p className="text-[14px] text-muted">Nothing logged yet.</p>
                ) : (
                  <ul className="divide-y divide-divider">
                    {current.entries.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 py-2.5 text-[14px]">
                        <span className="flex-1">
                          {fmtDate(e.date)}
                          {e.note && <span className="block text-[12.5px] text-muted">{e.note}</span>}
                        </span>
                        <span className="font-semibold tabular-nums">{M(e.amount)}</span>
                        <button
                          type="button"
                          onClick={() => run(() => budget.removeEntry.mutateAsync(e.id), { type: 'detail', id: currentItem.id })}
                          className="rounded-md p-1.5 text-muted hover:bg-loss-bg hover:text-loss"
                          aria-label={`Remove ${M(e.amount)} on ${fmtDate(e.date)}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}

function CategoryTile({ category, size = 40 }: { category: string; size?: number }) {
  const m = categoryMeta(category);
  const Icon = m.icon;
  return (
    <span className="grid flex-none place-items-center rounded-[10px]" style={{ width: size, height: size, background: m.tint, color: m.color }} aria-hidden>
      <Icon style={{ width: size * 0.45, height: size * 0.45 }} />
    </span>
  );
}

function Bar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div className="h-[5px] w-full max-w-[240px] overflow-hidden rounded-full bg-[var(--color-neutral-200)]">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, background: color }} />
    </div>
  );
}

const COLS = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 md:grid-cols-[minmax(0,1fr)_120px_120px_minmax(150px,240px)_132px]';

/** Grouped planned-vs-actual table: category rows with totals, then each item with status and its action. */
function BudgetTable({
  heading,
  rows,
  categories,
  metaLine,
  onOpen,
  onDone,
  onLog,
  empty,
  busy,
}: {
  heading: string;
  rows: BudgetRow[];
  categories: readonly string[];
  metaLine: (i: BudgetItem) => string;
  onOpen: (id: string) => void;
  onDone: (r: BudgetRow) => void;
  onLog: (id: string) => void;
  empty: ReactNode;
  busy: boolean;
}) {
  const { M } = useMoney();
  const income = heading === 'Income';
  const groups = categories.map((c) => ({ c, rows: rows.filter((r) => r.item.category === c) })).filter((g) => g.rows.length > 0);

  return (
    <Panel flush className="overflow-hidden">
      <div className={cn(COLS, 'border-b border-divider px-6 py-3 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted')}>
        <span>{heading}</span>
        <span className="hidden text-right md:block">Planned</span>
        <span className="text-right">{income ? 'Received' : 'Actual'}</span>
        <span className="hidden md:block">Progress</span>
        <span className="hidden md:block" />
      </div>
      {groups.length === 0 && <p className="px-6 py-6 text-[14px] text-muted">{empty}</p>}
      {groups.map((g, gi) => {
        const planned = g.rows.reduce((s, r) => s + r.planned, 0);
        const actual = g.rows.reduce((s, r) => s + r.actual, 0);
        const meta = categoryMeta(g.c);
        return (
          <div key={g.c} className={cn(gi > 0 && 'mt-6 border-t border-divider')}>
            <div className={cn(COLS, 'border-b border-divider px-6 py-3.5')}>
              <div className="flex min-w-0 items-center gap-3">
                <CategoryTile category={g.c} />
                <span className="text-[17px] font-semibold">{g.c}</span>
                <span className="text-[14px] text-muted">
                  {g.rows.length} item{g.rows.length === 1 ? '' : 's'}
                </span>
              </div>
              <span className="hidden text-right text-[16px] font-semibold tabular-nums md:block">{M(planned)}</span>
              <span className="text-right text-[16px] font-semibold tabular-nums">{M(actual)}</span>
              <span className="hidden md:block">
                <Bar ratio={planned ? actual / planned : 0} color={meta.color} />
              </span>
              <span className="hidden md:block" />
            </div>
            {g.rows.map((r) => {
              const barColor = r.tone === 'loss' && r.item.costType === 'variable' ? 'var(--fin-loss)' : r.done ? 'var(--fin-gain)' : 'var(--color-accent)';
              return (
                <div
                  key={r.item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(r.item.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(r.item.id))}
                  className={cn(COLS, 'cursor-pointer gap-y-2 border-b border-divider py-3.5 pl-6 pr-6 last:border-b-0 hover:bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)] md:pl-[76px]')}>
                  <div className="min-w-0">
                    <div className="truncate text-[15.5px]">{r.item.name}</div>
                    <div className="truncate text-[13px] text-muted">{metaLine(r.item)}</div>
                  </div>
                  <span className="hidden text-right tabular-nums text-muted md:block">{M(r.planned)}</span>
                  <span className="text-right">
                    <span className="block font-semibold tabular-nums">{M(r.actual)}</span>
                    <span className="block text-[12.5px] tabular-nums text-muted md:hidden">of {M(r.planned)}</span>
                  </span>
                  <div className="col-span-2 md:col-span-1">
                    <Bar ratio={r.ratio} color={barColor} />
                    <div className={cn('mt-1.5 text-[13px]', TONE_TEXT[r.tone])}>{r.status}</div>
                  </div>
                  <div className="col-span-2 flex justify-end md:col-span-1" onClick={(e) => e.stopPropagation()}>
                    {r.item.costType === 'fixed' ? (
                      !r.done && (
                        <Button variant="secondary" size="sm" icon={Check} disabled={busy} onClick={() => onDone(r)}>
                          {income ? 'Received' : 'Mark paid'}
                        </Button>
                      )
                    ) : (
                      <Button variant="ghost" size="sm" icon={Plus} onClick={() => onLog(r.item.id)}>
                        {income ? 'Log income' : 'Log spend'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </Panel>
  );
}

/** Amount · date · note for one payment or spend. */
function LogEntryForm({
  income,
  suggested,
  defaultDate,
  month,
  onSave,
  onCancel,
  isSaving,
  error,
}: {
  income: boolean;
  suggested: number;
  defaultDate: string;
  month: string;
  onSave: (v: { amount: string; date: string; note: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
  error?: string;
}) {
  const [amount, setAmount] = useState(suggested > 0 ? String(Math.round(suggested * 100) / 100) : '');
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState('');
  const field = 'w-full px-3 py-2 border border-divider rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-[var(--input-bg)]';
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ amount, date, note });
      }}>
      {error && <p role="alert" className="rounded-lg bg-loss-bg p-3 text-[13.5px] text-loss">{error}</p>}
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-800" htmlFor="log-amount">Amount (₹) *</label>
        <input id="log-amount" type="number" required min="0.01" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-800" htmlFor="log-date">Date *</label>
        <input id="log-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        <p className="mt-1 text-[12px] text-muted">Counts towards {monthLabel(month)}.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-800" htmlFor="log-note">Note</label>
        <input id="log-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={income ? 'e.g. Bonus' : 'e.g. Big Basket order'} className={field} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" icon={Check} disabled={isSaving}>
          {income ? 'Log income' : 'Log spend'}
        </Button>
      </div>
    </form>
  );
}
