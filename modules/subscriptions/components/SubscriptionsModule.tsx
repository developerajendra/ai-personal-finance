'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Pencil, Plus } from 'lucide-react';
import type { Subscription } from '@/shared/types';
import { cn } from '@/shared/utils/cn';
import { Button, Dot, EmptyState, PageHeader, Panel, PanelHeader, Segmented, Skeleton, StackBar, Tag } from '@/shared/components/ui';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { SubscriptionForm } from './SubscriptionForm';
import { CATEGORY_COLOR, FOREIGN_GST, daysUntilDate, inrPerCycle, monogramOf, monthlyINR, priceLabel, useSubscriptions } from '../useSubscriptions';

/** Coloured monogram tile (brand colour when known). */
export function SubTile({ s, size = 40 }: { s: Pick<Subscription, 'name' | 'monogram' | 'color'>; size?: number }) {
  return (
    <span
      className="grid flex-none place-items-center rounded-[10px] font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.35, background: s.color || 'var(--color-neutral-600)' }}
      aria-hidden>
      {monogramOf(s)}
    </span>
  );
}

/** "Renews 5 Oct 2026" / "Ends 5 Oct 2026" — warn tone within a week. */
export function dateLine(s: Subscription) {
  const d = daysUntilDate(s.nextDate);
  const verb = s.ends ? 'Ends' : s.status === 'Cancelled' ? 'Ended' : 'Renews';
  return {
    text: `${verb} ${fmtDate(s.nextDate)}`,
    sub: d < 0 ? `${-d} days ago` : d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`,
    soon: s.status === 'Active' && d >= 0 && d <= 7,
  };
}

export function SubscriptionsModule() {
  const { M } = useMoney();
  const { all, active, perMonth, perYear, next, isLoading, update } = useSubscriptions();
  const [view, setView] = useState<'Active' | 'Cancelled' | 'All'>('Active');
  const [form, setForm] = useState<{ open: boolean; editing: Subscription | null }>({ open: false, editing: null });

  const byCat = useMemo(() => {
    const m = new Map<Subscription['category'], number>();
    for (const s of active) m.set(s.category, (m.get(s.category) ?? 0) + monthlyINR(s));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [active]);
  const top = byCat[0];
  const cancelled = all.filter((s) => s.status === 'Cancelled');
  const shown = view === 'All' ? all : view === 'Active' ? active : cancelled;
  const nextLine = next ? dateLine(next) : null;

  const kpi = (label: string, value: string, note: string, noteClass = 'text-muted') => (
    <Panel>
      <div className="eyebrow">{label}</div>
      <div className="mt-2.5 truncate text-[24px] font-bold tracking-[-0.02em]">{value}</div>
      <div className={cn('mt-2.5 text-[13px]', noteClass)}>{note}</div>
    </Panel>
  );

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Planning' }, { label: 'Subscriptions' }]}
        title="Subscriptions"
        actions={
          <Button icon={Plus} onClick={() => setForm({ open: true, editing: null })}>
            Add subscription
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px] !rounded-panel" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <Panel>
          <EmptyState
            title="Track what you pay for every month"
            action={
              <Button icon={Plus} onClick={() => setForm({ open: true, editing: null })}>
                Add your first subscription
              </Button>
            }>
            Add Netflix, ChatGPT, iCloud and anything else that renews. You’ll see the monthly and yearly cost, what renews next, and get a reminder 3 days before.
          </EmptyState>
        </Panel>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpi('Per month', M(perMonth), `${active.length} active subscription${active.length === 1 ? '' : 's'}`)}
            {kpi('Per year', M(perYear), 'Annual plans included')}
            {next && nextLine
              ? kpi('Next date', next.name, `${nextLine.text} · ${nextLine.sub}`, nextLine.soon ? 'text-warn' : 'text-muted')
              : kpi('Next date', '—', 'Nothing active')}
            {top ? kpi(top[0], M(top[1]), `${perMonth ? Math.round((top[1] / perMonth) * 100) : 0}% of subscription spend`) : kpi('Top category', '—', '')}
          </div>

          {byCat.length > 0 && (
            <Panel>
              <PanelHeader title="Where it goes" action={<span className="text-[13px] text-muted">Monthly equivalent by category · annual plans ÷ 12</span>} />
              <StackBar segments={byCat.map(([c, v]) => ({ value: v, color: CATEGORY_COLOR[c], label: c }))} height={12} />
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
                {byCat.map(([c, v]) => (
                  <span key={c} className="flex items-center gap-2">
                    <Dot color={CATEGORY_COLOR[c]} size={10} />
                    {c} <strong className="font-semibold tabular-nums">{M(v)}/mo</strong>
                  </span>
                ))}
              </div>
            </Panel>
          )}

          <Panel>
            <PanelHeader
              title="Subscriptions"
              action={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Segmented
                    value={view}
                    onChange={setView}
                    ariaLabel="Show"
                    options={[
                      { value: 'Active', label: `Active · ${active.length}` },
                      { value: 'Cancelled', label: `Cancelled · ${cancelled.length}` },
                      { value: 'All', label: 'All' },
                    ]}
                  />
                  <Button icon={Plus} onClick={() => setForm({ open: true, editing: null })} className="hidden sm:inline-flex">
                    Add subscription
                  </Button>
                </div>
              }
            />
            {shown.length === 0 ? (
              <p className="py-6 text-[14px] text-muted">No {view.toLowerCase()} subscriptions.</p>
            ) : (
              <ul>
                {shown.map((s) => {
                  const dl = dateLine(s);
                  return (
                    <li
                      key={s.id}
                      className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-divider py-3.5 last:border-0 lg:grid-cols-[40px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto]">
                      <SubTile s={s} />
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                        <span className="block truncate text-[13px] text-muted">{[s.plan, s.category, s.notes].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="text-right lg:text-left">
                        <span className="block text-[15px] font-semibold tabular-nums">{priceLabel(s)}</span>
                        <span className="block text-[13px] text-muted tabular-nums">
                          {s.currency !== 'INR'
                            ? `≈ ${M(inrPerCycle(s))}${s.currency === 'USD' ? ' incl. GST' : ''}`
                            : s.cycle === 'Yearly'
                              ? `≈ ${M(monthlyINR(s))}/mo`
                              : 'Billed in INR'}
                        </span>
                      </span>
                      <span className="col-span-2 col-start-2 lg:col-span-1 lg:col-start-auto">
                        <span className={cn('block text-[14.5px]', dl.soon ? 'text-warn' : 'text-ink')}>{dl.text}</span>
                        <span className="block text-[13px] text-muted">{dl.sub}</span>
                      </span>
                      <span className="col-span-2 col-start-2 lg:col-span-1 lg:col-start-auto">
                        <span className="block truncate text-[14.5px]">{s.paidWith || '—'}</span>
                        <Tag tone={s.status === 'Active' ? 'gain' : 'loss'} className="mt-1 font-semibold">
                          {s.status}
                        </Tag>
                      </span>
                      <span className="col-span-3 flex justify-end gap-2 lg:col-span-1">
                        {s.status === 'Active' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-pressed={s.remind}
                            onClick={() => update.mutate({ id: s.id, patch: { remind: !s.remind } })}
                            className={cn('min-w-[106px]', s.remind && '!bg-accent-100 !text-accent-800')}>
                            {s.remind ? 'Reminder on' : 'Remind me'}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setForm({ open: true, editing: s })}>
                          Edit
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-[13px] text-muted">USD plans are converted at the app’s exchange rate and include {Math.round(FOREIGN_GST * 100)}% GST.</p>
          </Panel>
        </div>
      )}

      <SubscriptionForm open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />
    </div>
  );
}

/** Overview card: monthly total, due this week, and the next few renewals as tiles. */
export function SubscriptionsCard() {
  const { M } = useMoney();
  const { active, perMonth, dueThisWeek, isLoading } = useSubscriptions();
  const [form, setForm] = useState(false);
  const upcoming = [...active].sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 8);

  return (
    <Panel>
      <PanelHeader
        title="Subscriptions"
        subtitle={isLoading ? ' ' : `${M(perMonth)} per month · ${active.length} active · ${dueThisWeek} due this week`}
        action={
          <>
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setForm(true)}>
              <span className="hidden sm:inline">Add subscription</span>
              <span className="sm:hidden">Add</span>
            </Button>
            <Link href="/subscriptions" className="flex items-center gap-1 rounded-md px-2 py-1 text-[14px] font-medium text-accent-700 hover:bg-accent-100">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </>
        }
      />
      {upcoming.length === 0 ? (
        <p className="text-[14px] text-muted">{isLoading ? 'Loading…' : 'No subscriptions yet — add the services you pay for to track renewals.'}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {upcoming.map((s) => {
            const dl = dateLine(s);
            return (
              <Link key={s.id} href="/subscriptions" className="flex items-center gap-3 rounded-[14px] bg-tile px-3.5 py-3 transition-colors hover:bg-accent-100">
                <SubTile s={s} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold">{s.name}</span>
                    <span className="flex-none text-[13.5px] font-semibold tabular-nums">{priceLabel(s)}</span>
                  </span>
                  <span className={cn('block truncate text-[12.5px]', dl.soon ? 'text-warn' : 'text-muted')}>
                    {dl.text} · {dl.sub}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <SubscriptionForm open={form} editing={null} onClose={() => setForm(false)} />
    </Panel>
  );
}
