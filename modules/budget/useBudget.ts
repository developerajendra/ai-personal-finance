'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { Briefcase, Car, Coins, GraduationCap, HeartPulse, Home, ShieldCheck, ShoppingCart, Wallet, Zap } from 'lucide-react';
import type { BudgetEntry, BudgetItem } from '@/shared/types';
import type { BudgetEntryInput, BudgetItemInput } from '@/shared/schemas/finance';

/* ------------------------------------------------------------ months */

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const shiftMonth = (key: string, by: number) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y!, m! - 1 + by, 1));
};
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]!);
};

/* -------------------------------------------------------- categories */

export const CATEGORY_META: Record<string, { icon: LucideIcon; color: string; tint: string }> = {
  Home: { icon: Home, color: 'var(--color-accent)', tint: 'var(--color-accent-100)' },
  Utilities: { icon: Zap, color: 'var(--fin-warn)', tint: 'var(--fin-warn-bg)' },
  Transport: { icon: Car, color: 'var(--color-accent-400)', tint: 'var(--color-accent-100)' },
  Living: { icon: ShoppingCart, color: 'var(--fin-gain)', tint: 'var(--fin-gain-bg)' },
  Education: { icon: GraduationCap, color: 'var(--color-accent-700)', tint: 'var(--color-accent-100)' },
  Health: { icon: HeartPulse, color: 'var(--fin-loss)', tint: 'var(--fin-loss-bg)' },
  Insurance: { icon: ShieldCheck, color: 'var(--color-neutral-600)', tint: 'var(--color-neutral-100)' },
  Other: { icon: Wallet, color: 'var(--color-neutral-600)', tint: 'var(--color-neutral-100)' },
  Salary: { icon: Briefcase, color: 'var(--fin-gain)', tint: 'var(--fin-gain-bg)' },
  'Other income': { icon: Coins, color: 'var(--fin-gain)', tint: 'var(--fin-gain-bg)' },
};
export const categoryMeta = (c: string) => CATEGORY_META[c] ?? CATEGORY_META.Other!;

/** Quick-add presets: [name, category, costType, frequency, dueDay?] */
export const EXPENSE_PRESETS: [string, string, BudgetItem['costType'], BudgetItem['frequency'], number?][] = [
  ['House rent / instalment', 'Home', 'fixed', 'monthly', 5],
  ['Society maintenance', 'Home', 'fixed', 'monthly', 10],
  ['Electricity bill', 'Utilities', 'variable', 'monthly', 15],
  ['Mobile bill', 'Utilities', 'fixed', 'monthly', 20],
  ['Internet', 'Utilities', 'fixed', 'monthly', 20],
  ['Grocery', 'Living', 'variable', 'monthly'],
  ['Fuel', 'Transport', 'variable', 'monthly'],
  ['School fees', 'Education', 'fixed', 'yearly'],
  ['Medicines & doctor', 'Health', 'variable', 'monthly'],
  ['Health insurance', 'Insurance', 'fixed', 'yearly'],
];

/* -------------------------------------------------------------- rows */

export type Tone = 'gain' | 'loss' | 'warn' | 'muted' | 'accent';

export interface BudgetRow {
  item: BudgetItem;
  entries: BudgetEntry[];
  planned: number;
  actual: number;
  /** 0–1+, share of plan used */
  ratio: number;
  /** yyyy-mm-dd, when the item has a due day */
  dueDate?: string;
  done: boolean;
  status: string;
  tone: Tone;
}

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((new Date(`${toIso}T00:00:00`).getTime() - new Date(`${fromIso}T00:00:00`).getTime()) / 864e5);
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** Does this item fall in the given month? Yearly items only in their due month. */
export const appliesIn = (item: BudgetItem, month: string) =>
  item.active && (item.frequency === 'monthly' || item.dueMonth === Number(month.slice(5)));

/** Planned vs actual, due date and the status line ("Due in 3 days", "Paid 2 Oct", "₹2,500 left · 38% used"). */
export function buildRow(item: BudgetItem, entries: BudgetEntry[], month: string, fmt: (n: number) => string): BudgetRow {
  const planned = item.amount;
  const actual = entries.reduce((s, e) => s + e.amount, 0);
  const ratio = planned > 0 ? actual / planned : 0;
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y!, m!, 0).getDate();
  const dueDate = item.dueDay ? ymd(new Date(y!, m! - 1, Math.min(item.dueDay, lastDay))) : undefined;
  const today = ymd(new Date());
  const thisMonth = monthKey();
  const income = item.kind === 'income';
  const lastEntry = entries[entries.length - 1];

  if (item.costType === 'fixed') {
    const done = actual >= planned - 0.5;
    if (done) return { item, entries, planned, actual, ratio, dueDate, done, status: `${income ? 'Received' : 'Paid'} ${shortDate(lastEntry!.date)}`, tone: 'gain' };
    if (actual > 0) return { item, entries, planned, actual, ratio, dueDate, done, status: `${fmt(planned - actual)} still ${income ? 'to come' : 'to pay'}`, tone: 'warn' };
    let status = income ? 'Not received yet' : 'Not paid yet';
    let tone: Tone = 'muted';
    if (month < thisMonth) {
      status = income ? 'Not received' : 'Missed';
      tone = 'loss';
    } else if (month > thisMonth) {
      status = dueDate ? `Due ${shortDate(dueDate)}` : 'Upcoming';
    } else if (dueDate) {
      const d = daysBetween(today, dueDate);
      status = d < 0 ? `Overdue by ${-d} day${d === -1 ? '' : 's'}` : d === 0 ? 'Due today' : `${income ? 'Expected' : 'Due'} in ${d} day${d === 1 ? '' : 's'}`;
      tone = d < 0 ? (income ? 'warn' : 'loss') : d <= 7 ? 'warn' : 'muted';
    }
    return { item, entries, planned, actual, ratio, dueDate, done, status, tone };
  }

  // Variable: spent (or received) against a cap
  if (income) {
    return { item, entries, planned, actual, ratio, dueDate, done: ratio >= 1, status: `${fmt(actual)} of ${fmt(planned)} received`, tone: ratio >= 1 ? 'gain' : 'muted' };
  }
  const over = actual - planned;
  if (over > 0.5) return { item, entries, planned, actual, ratio, dueDate, done: false, status: `${fmt(over)} over budget`, tone: 'loss' };
  return {
    item,
    entries,
    planned,
    actual,
    ratio,
    dueDate,
    done: false,
    status: `${fmt(planned - actual)} left · ${Math.round(ratio * 100)}% used`,
    tone: ratio >= 0.9 ? 'warn' : 'muted',
  };
}

/** Monthly equivalent of an item (yearly ÷ 12). */
export const monthlyEquivalent = (item: BudgetItem) => (item.frequency === 'yearly' ? item.amount / 12 : item.amount);

/** Next yyyy-mm a yearly item falls due, from the given month. */
export const nextDueMonth = (item: BudgetItem, from: string) => {
  const [y, m] = from.split('-').map(Number);
  const due = item.dueMonth ?? m!;
  return `${due >= m! ? y : y! + 1}-${String(due).padStart(2, '0')}`;
};

/** Default date for a payment logged while viewing `month`: today in the current month, else the due date or the 1st. */
export const defaultEntryDate = (month: string, dueDate?: string) => (month === monthKey() ? ymd(new Date()) : dueDate ?? `${month}-01`);

/* ------------------------------------------------------------- query */

export const budgetKey = (month: string) => ['budget', month] as const;

export function useBudget(month: string) {
  const qc = useQueryClient();
  const query = useQuery<{ items: BudgetItem[]; entries: BudgetEntry[] }>({
    queryKey: budgetKey(month),
    queryFn: async () => {
      const res = await fetch(`/api/budget?month=${month}`);
      if (!res.ok) throw new Error('Failed to load budget');
      return res.json();
    },
  });

  const call = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };
  // Items are shared by every month; entries by their own month — refresh all cached months
  const done = () => qc.invalidateQueries({ queryKey: ['budget'] });

  const createItem = useMutation({ mutationFn: (input: BudgetItemInput) => call('/api/budget/items', 'POST', input), onSuccess: done });
  const updateItem = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<BudgetItemInput> | Record<string, unknown> }) => call(`/api/budget/items/${id}`, 'PATCH', patch),
    onSuccess: done,
  });
  const removeItem = useMutation({ mutationFn: (id: string) => call(`/api/budget/items/${id}`, 'DELETE'), onSuccess: done });
  const addEntry = useMutation({ mutationFn: (input: BudgetEntryInput) => call('/api/budget/entries', 'POST', input), onSuccess: done });
  const removeEntry = useMutation({ mutationFn: (id: string) => call(`/api/budget/entries/${id}`, 'DELETE'), onSuccess: done });

  return {
    ...query,
    items: query.data?.items ?? [],
    entries: query.data?.entries ?? [],
    createItem,
    updateItem,
    removeItem,
    addEntry,
    removeEntry,
  };
}
