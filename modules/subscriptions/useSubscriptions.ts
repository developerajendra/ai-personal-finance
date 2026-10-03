'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Subscription } from '@/shared/types';
import type { SubscriptionInput } from '@/shared/schemas/finance';
import { convertToINR, type Currency } from '@/shared/utils/currency';

export const SUBSCRIPTIONS_KEY = ['subscriptions'] as const;

/** GST added to foreign-currency (USD) plans, as charged by most providers in India. */
export const FOREIGN_GST = 0.18;

/** INR cost of one billing cycle (USD plans include GST). */
export const inrPerCycle = (s: Pick<Subscription, 'amount' | 'currency'>) =>
  s.currency === 'USD' ? convertToINR(s.amount, 'USD') * (1 + FOREIGN_GST) : convertToINR(s.amount, s.currency as Currency);

/** Monthly equivalent in INR (yearly plans ÷ 12). */
export const monthlyINR = (s: Pick<Subscription, 'amount' | 'currency' | 'cycle'>) => inrPerCycle(s) / (s.cycle === 'Yearly' ? 12 : 1);

export const priceLabel = (s: Pick<Subscription, 'amount' | 'currency' | 'cycle'>) => {
  const sym = s.currency === 'USD' ? '$' : s.currency === 'NPR' ? 'Rs ' : '₹';
  const n = s.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return `${sym}${n}/${s.cycle === 'Yearly' ? 'yr' : 'mo'}`;
};

export const daysUntilDate = (iso: string) => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const d = new Date(`${iso}T00:00:00`);
  return Math.round((d.getTime() - t.getTime()) / 864e5);
};

export const CATEGORY_COLOR: Record<Subscription['category'], string> = {
  'AI tools': 'var(--c-stock)',
  Entertainment: 'var(--c-fund)',
  'Cloud & storage': 'var(--c-ret)',
  Other: 'var(--c-prop)',
};

/** Quick-fill presets from the design: [name, plan, category, amount, currency, colour, monogram] */
export const PRESETS: [string, string, Subscription['category'], number, Subscription['currency'], string, string][] = [
  ['Claude', 'Pro', 'AI tools', 20, 'USD', '#c96442', 'C'],
  ['ChatGPT', 'Plus', 'AI tools', 20, 'USD', '#10a37f', 'G'],
  ['Perplexity', 'Pro', 'AI tools', 20, 'USD', '#1f6f78', 'P'],
  ['Cursor', 'Pro', 'AI tools', 20, 'USD', '#111111', 'Cu'],
  ['Notion', 'Plus', 'Other', 10, 'USD', '#37352f', 'N'],
  ['Prime Video', 'Monthly', 'Entertainment', 299, 'INR', '#00a8e1', 'PV'],
];

export const monogramOf = (s: Pick<Subscription, 'name' | 'monogram'>) =>
  s.monogram ||
  s.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Subscriptions with create / update / delete, sharing one query cache across Overview and the page. */
export function useSubscriptions() {
  const qc = useQueryClient();
  const query = useQuery<Subscription[]>({
    queryKey: SUBSCRIPTIONS_KEY,
    queryFn: async () => {
      const res = await fetch('/api/subscriptions');
      if (!res.ok) throw new Error('Failed to load subscriptions');
      return res.json();
    },
  });

  const call = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };
  const done = () => qc.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });

  const create = useMutation({ mutationFn: (input: SubscriptionInput) => call('/api/subscriptions', 'POST', input), onSuccess: done });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SubscriptionInput> }) => call(`/api/subscriptions/${id}`, 'PATCH', patch),
    // Optimistic so toggles (Remind me) feel instant
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: SUBSCRIPTIONS_KEY });
      const prev = qc.getQueryData<Subscription[]>(SUBSCRIPTIONS_KEY);
      qc.setQueryData<Subscription[]>(SUBSCRIPTIONS_KEY, (xs) => xs?.map((x) => (x.id === id ? ({ ...x, ...patch } as Subscription) : x)));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(SUBSCRIPTIONS_KEY, ctx.prev),
    onSettled: done,
  });
  const remove = useMutation({ mutationFn: (id: string) => call(`/api/subscriptions/${id}`, 'DELETE'), onSuccess: done });

  const all = query.data ?? [];
  const active = all.filter((s) => s.status === 'Active');
  const perMonth = active.reduce((sum, s) => sum + monthlyINR(s), 0);
  const next = [...active].sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0];
  const dueThisWeek = active.filter((s) => {
    const d = daysUntilDate(s.nextDate);
    return d >= 0 && d <= 7;
  }).length;

  return { ...query, all, active, perMonth, perYear: perMonth * 12, next, dueThisWeek, create, update, remove };
}
