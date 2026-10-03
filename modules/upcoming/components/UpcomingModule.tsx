'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { Amount, EmptyState, PageHeader, Panel, Segmented, Tag, signClass } from '@/shared/components/ui';
import { useMoney } from '@/shared/hooks/useMoney';
import { useFinancialData } from '@/shared/hooks/useFinancialData';
import { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';
import { buildCashEvents, type CashEvent } from '@/shared/utils/upcoming';
import { useSubscriptions } from '@/modules/subscriptions/useSubscriptions';

type Horizon = '3' | '6' | '12';
type Flow = 'All' | 'Inflows' | 'Outflows';

/** 90-day+ calendar of cash events derived from loans, deposits, receivables and salary history. */
export function UpcomingModule() {
  const { M, S } = useMoney();
  const t = usePortfolioTotals();
  const { transactions } = useFinancialData();
  const [horizon, setHorizon] = useState<Horizon>('6');
  const [flow, setFlow] = useState<Flow>('All');

  const { active: subscriptions } = useSubscriptions();
  const { upcoming, overdue } = useMemo(
    () => buildCashEvents({ loans: t.loans, investments: t.investments, bankBalances: t.bankBalances, transactions, subscriptions }, Number(horizon)),
    [t.loans, t.investments, t.bankBalances, transactions, subscriptions, horizon],
  );

  const keep = (e: CashEvent) => flow === 'All' || (flow === 'Inflows' ? e.amount > 0 : e.amount < 0);
  const events = upcoming.filter(keep);
  const late = overdue.filter(keep);

  const expectedIn = upcoming.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const committedOut = upcoming.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);
  const overdueIn = overdue.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const net = expectedIn - committedOut;

  const months = useMemo(() => {
    const m = new Map<string, CashEvent[]>();
    for (const e of events) {
      const k = e.date.slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [events]);

  const row = (e: CashEvent, isLate?: boolean) => {
    const d = new Date(e.date);
    return (
      <li key={e.id} className="border-b border-divider last:border-0">
        <Link href={e.href} className="grid grid-cols-[56px_1fr_auto] items-start gap-3 py-3.5 hover:opacity-80">
          {isLate ? (
            <span className="pt-0.5 text-[13px] text-loss">{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          ) : (
            <span className="leading-tight">
              <span className="block text-[17px] font-bold">{d.getDate()}</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
            </span>
          )}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-[15px]">
              {e.title}
              {e.expected && <Tag className="!text-[11px]">expected</Tag>}
            </span>
            <span className="mt-0.5 block text-[13px] text-muted">{e.sub}</span>
          </span>
          <Amount value={e.amount} className="text-[15px]" />
        </Link>
      </li>
    );
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Overview', href: '/dashboard' }, { label: 'Upcoming' }]}
        title="Upcoming cash events"
        hero={{
          value: S(net),
          tone: Math.abs(net) < 0.005 ? 'neutral' : net > 0 ? 'gain' : 'loss',
          metas: [
            { label: 'Expected in', value: M(expectedIn), tone: 'gain' },
            { label: 'Committed out', value: M(committedOut), tone: committedOut > 0 ? 'loss' : 'neutral' },
            { label: 'Overdue to you', value: M(overdueIn), tone: overdueIn > 0 ? 'gain' : 'neutral' },
            { label: 'Horizon', value: `Next ${horizon} months` },
          ],
        }}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented<Horizon>
          value={horizon}
          onChange={setHorizon}
          ariaLabel="Horizon"
          options={[
            { value: '3', label: '3 months' },
            { value: '6', label: '6 months' },
            { value: '12', label: '12 months' },
          ]}
        />
        <Segmented<Flow> value={flow} onChange={setFlow} options={['All', 'Inflows', 'Outflows']} ariaLabel="Direction" />
        <p className="text-[13px] text-muted">Salary is projected from recent months and marked “expected”.</p>
      </div>

      <div className="max-w-[960px] space-y-5">
        {late.length > 0 && (
          <Panel>
            <div className="mb-1 flex items-baseline justify-between border-b border-divider pb-3">
              <h2 className="text-[19px] text-loss">Overdue</h2>
              <Amount value={late.reduce((s, e) => s + e.amount, 0)} className="text-[13px]" />
            </div>
            <ul>{late.map((e) => row(e, true))}</ul>
          </Panel>
        )}

        {months.length === 0 && late.length === 0 && (
          <Panel>
            <EmptyState title="Nothing scheduled in this window">
              Upcoming events come from active loans (EMIs), deposits with a maturity date, receivables with a due date, and salary credits in your transactions.
            </EmptyState>
          </Panel>
        )}

        {months.map(([key, list]) => {
          const inn = list.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
          const out = list.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);
          const [y, m] = key.split('-').map(Number);
          return (
            <Panel key={key}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 border-b border-divider pb-3">
                <h2 className="text-[19px]">{new Date(y!, m! - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
                <span className="flex gap-4 text-[13px] tabular-nums">
                  <span className="text-gain">In {M(inn)}</span>
                  <span className={out > 0 ? 'text-loss' : 'text-muted'}>Out {M(out)}</span>
                  <span className={cn('font-semibold', signClass(inn - out))}>Net {S(inn - out)}</span>
                </span>
              </div>
              <ul>{list.map((e) => row(e))}</ul>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
