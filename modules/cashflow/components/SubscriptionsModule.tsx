'use client';

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Button, Drawer, Dot, LinkButton, MockBadge, Panel, PanelHeader, Segmented, StackBar, Tag } from '@/shared/components/ui';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { useFinancialData } from '@/shared/hooks/useFinancialData';
import { daysUntil } from '@/shared/hooks/usePortfolioTotals';
import { MOCK_GST, MOCK_SUBSCRIPTIONS, MOCK_USD_RATE, type Subscription } from '../mock/subscriptions.mock';

const CAT_COLOR: Record<Subscription['category'], string> = {
  'AI tools': 'var(--c-stock)',
  Entertainment: 'var(--c-fund)',
  'Cloud & storage': 'var(--c-ret)',
  Other: 'var(--c-prop)',
};

/** INR per billing cycle (USD plans include GST, as in the design) */
const inrPerCycle = (s: Subscription) => (s.currency === 'USD' ? s.amount * MOCK_USD_RATE * (1 + MOCK_GST) : s.amount);
const monthlyInr = (s: Subscription) => (s.cycle === 'Annual' ? inrPerCycle(s) / 12 : inrPerCycle(s));

/** Recurring debits found in real transactions: same description, ≥2 different months. */
function detectRecurring(transactions: { description: string; amount: number; date: string; type: string }[]) {
  const groups = new Map<string, { name: string; months: Set<string>; amounts: number[]; last: string }>();
  for (const t of transactions) {
    if (t.type !== 'debit' || !t.description) continue;
    const key = t.description.toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
    if (key.length < 3) continue;
    const g = groups.get(key) ?? { name: t.description, months: new Set(), amounts: [], last: t.date };
    g.months.add(t.date.slice(0, 7));
    g.amounts.push(Math.abs(t.amount));
    if (t.date > g.last) g.last = t.date;
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.months.size >= 2)
    .map((g) => {
      const avg = g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length;
      const steady = g.amounts.every((a) => Math.abs(a - avg) / avg < 0.15);
      return { name: g.name, months: g.months.size, avg, last: g.last, steady };
    })
    .filter((g) => g.steady)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);
}

export function SubscriptionsModule() {
  const { M } = useMoney();
  const { transactions } = useFinancialData();
  // MOCK: local state only — changes are not persisted until a subscriptions API exists.
  const [subs, setSubs] = useState<Subscription[]>(MOCK_SUBSCRIPTIONS);
  const [view, setView] = useState<'Active' | 'Cancelled' | 'All'>('Active');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', currency: 'INR' as Subscription['currency'], cycle: 'Monthly' as Subscription['cycle'] });
  const [formErr, setFormErr] = useState('');
  const [reminded, setReminded] = useState<Record<string, boolean>>({});

  const active = subs.filter((s) => s.status === 'Active');
  const perMonth = active.reduce((sum, s) => sum + monthlyInr(s), 0);
  const perYear = perMonth * 12;
  const next = [...active].sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal))[0];
  const byCat = useMemo(() => {
    const m = new Map<Subscription['category'], number>();
    for (const s of active) m.set(s.category, (m.get(s.category) ?? 0) + monthlyInr(s));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [active]);
  const top = byCat[0];
  const shown = subs.filter((s) => view === 'All' || (view === 'Active' ? s.status !== 'Cancelled' : s.status === 'Cancelled'));
  const recurring = useMemo(() => detectRecurring(transactions), [transactions]);

  const addSub = () => {
    const amount = parseFloat(form.amount);
    if (!form.name.trim()) return setFormErr('Enter a name.');
    if (!(amount > 0)) return setFormErr('Enter an amount greater than zero.');
    const d = new Date();
    d.setMonth(d.getMonth() + (form.cycle === 'Annual' ? 12 : 1));
    setSubs((xs) => [
      ...xs,
      {
        id: `new-${Date.now()}`,
        name: form.name.trim(),
        plan: form.cycle,
        category: 'Other',
        amount,
        currency: form.currency,
        cycle: form.cycle,
        nextRenewal: d.toISOString().slice(0, 10),
        account: '—',
        status: 'Active',
        color: 'var(--color-accent)',
      },
    ]);
    setAdding(false);
    setForm({ name: '', amount: '', currency: 'INR', cycle: 'Monthly' });
    setFormErr('');
  };

  const kpi = (label: string, value: string, note: string, noteTone?: string) => (
    <Panel>
      <div className="eyebrow">{label}</div>
      <div className="mt-2.5 truncate text-[24px] font-bold tracking-[-0.02em]">{value}</div>
      <div className={cn('mt-2.5 text-[13px]', noteTone ?? 'text-muted')}>{note}</div>
    </Panel>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <MockBadge />
        No subscriptions source is connected yet — the list below is placeholder data and changes are not saved.
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpi('Per month', M(perMonth), `${active.length} active subscriptions`)}
        {kpi('Per year', M(perYear), 'Annual plans included')}
        {next
          ? kpi('Next renewal', next.name, `${fmtDate(next.nextRenewal)} · ${M(inrPerCycle(next))} · in ${daysUntil(next.nextRenewal)} days`, 'text-warn')
          : kpi('Next renewal', '—', 'Nothing active')}
        {top ? kpi(top[0], M(top[1]), `${perMonth ? Math.round((top[1] / perMonth) * 100) : 0}% of subscription spend`) : kpi('Top category', '—', '')}
      </div>

      <Panel>
        <PanelHeader title="Where it goes" action={<span className="text-[13px] text-muted">Monthly equivalent by category · annual plans ÷ 12</span>} />
        <StackBar segments={byCat.map(([c, v]) => ({ value: v, color: CAT_COLOR[c], label: c }))} height={12} />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
          {byCat.map(([c, v]) => (
            <span key={c} className="flex items-center gap-2">
              <Dot color={CAT_COLOR[c]} size={10} />
              {c} <strong className="font-semibold">{M(v)}/mo</strong>
            </span>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Subscriptions"
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: 'Active', label: `Active · ${subs.filter((s) => s.status !== 'Cancelled').length}` },
                  { value: 'Cancelled', label: `Cancelled · ${subs.filter((s) => s.status === 'Cancelled').length}` },
                  { value: 'All', label: 'All' },
                ]}
              />
              <LinkButton href="/transactions" variant="secondary" icon={Search}>
                Find in transactions
              </LinkButton>
              <Button icon={Plus} onClick={() => setAdding(true)}>
                Add subscription
              </Button>
            </div>
          }
        />
        <ul>
          {shown.map((s) => {
            const d = daysUntil(s.nextRenewal) ?? 0;
            const soon = s.status === 'Active' && d <= 7;
            return (
              <li key={s.id} className="grid grid-cols-[40px_1fr_auto] items-center gap-x-3 gap-y-2 border-b border-divider py-3.5 last:border-0 lg:grid-cols-[40px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <span className="grid h-10 w-10 place-items-center rounded-[10px] text-[14px] font-bold text-white" style={{ background: s.color }}>
                  {s.name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {s.plan} · {s.category}
                  </span>
                </span>
                <span className="text-right lg:text-left">
                  <span className="block text-[15px] font-semibold">
                    {s.currency === 'USD' ? `$${s.amount}` : M(s.amount)}/{s.cycle === 'Annual' ? 'yr' : 'mo'}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {s.currency === 'USD' ? `≈ ${M(inrPerCycle(s))} incl. GST` : s.cycle === 'Annual' ? `≈ ${M(monthlyInr(s))}/mo` : 'Billed in INR'}
                  </span>
                </span>
                <span className="col-span-2 col-start-2 lg:col-span-1 lg:col-start-auto">
                  <span className={cn('block text-[14.5px]', soon ? 'text-warn' : 'text-ink')}>
                    {s.status === 'Cancelled' ? 'Ends' : 'Renews'} {fmtDate(s.nextRenewal)}
                  </span>
                  <span className="block text-[13px] text-muted">in {d} days</span>
                </span>
                <span className="col-span-2 col-start-2 lg:col-span-1 lg:col-start-auto">
                  <span className="block truncate text-[14.5px]">{s.account}</span>
                  <Tag tone={s.status === 'Active' ? 'gain' : s.status === 'Cancelled' ? 'loss' : 'warn'} className="mt-1 font-semibold">
                    {s.status}
                  </Tag>
                </span>
                <span className="col-span-3 flex justify-end gap-2 lg:col-span-1">
                  {s.status === 'Active' && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => setReminded((r) => ({ ...r, [s.id]: !r[s.id] }))}>
                        {reminded[s.id] ? 'Reminder set' : 'Remind me'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSubs((xs) => xs.map((x) => (x.id === s.id ? { ...x, status: 'Cancelled' } : x)))}>
                        Mark cancelled
                      </Button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[13px] text-muted">
          USD plans converted at ₹{MOCK_USD_RATE} per $ (sample rate), including {Math.round(MOCK_GST * 100)}% GST where the provider charges it.
        </p>
      </Panel>

      {/* Real data: recurring debits detected in existing transactions */}
      <Panel>
        <PanelHeader title="Recurring payments in your transactions" subtitle="Same payee, similar amount, in two or more months — candidates to track as subscriptions." />
        {recurring.length === 0 ? (
          <p className="text-[14px] text-muted">No recurring debits found yet. Import a few months of bank statements to detect them.</p>
        ) : (
          <ul>
            {recurring.map((r) => (
              <li key={r.name} className="flex items-center justify-between gap-3 border-b border-divider py-3 last:border-0">
                <span className="min-w-0">
                  <span className="block truncate text-[15px]">{r.name}</span>
                  <span className="block text-[13px] text-muted">
                    Seen in {r.months} months · last {fmtDate(r.last)}
                  </span>
                </span>
                <span className="text-[15px] font-semibold tabular-nums">≈ {M(r.avg)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Drawer
        open={adding}
        onClose={() => setAdding(false)}
        title="Add subscription"
        subtitle="Sample data — not saved"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={addSub}>Add</Button>
          </>
        }>
        <div className="space-y-4">
          <label className="block">
            <span className="field-label">Name</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. YouTube Premium" />
          </label>
          <label className="block">
            <span className="field-label">Amount</span>
            <input className="input" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
          </label>
          <div className="flex flex-wrap gap-4">
            <div>
              <span className="field-label">Currency</span>
              <Segmented value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} options={['INR', 'USD']} />
            </div>
            <div>
              <span className="field-label">Billing</span>
              <Segmented value={form.cycle} onChange={(v) => setForm({ ...form, cycle: v })} options={['Monthly', 'Annual']} />
            </div>
          </div>
          {formErr && <p className="text-[13px] text-loss">{formErr}</p>}
        </div>
      </Drawer>
    </div>
  );
}
