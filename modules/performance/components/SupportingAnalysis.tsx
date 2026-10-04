'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { Panel, PanelHeader } from '@/shared/components/ui';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import type { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';
import type { Transaction } from '@/shared/types';
import { cn } from '@/shared/utils/cn';
import { cashFlowForMonth, investmentSummary } from '@/shared/utils/dashboardInsights';
import { fetchLoanSnapshots } from '@/modules/portfolio/components/LoanAnalyticsModule';

type Totals = ReturnType<typeof usePortfolioTotals>;

function Limitation({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-1.5 text-[13px] text-muted">
      <Info className="mt-[2px] h-3.5 w-3.5 flex-none" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

/** 5. Investment returns, cash-flow history and debt repayment history — each only where records support it. */
export function SupportingAnalysis({ t, transactions, marketLive, now }: { t: Totals; transactions: Transaction[]; marketLive: boolean | undefined; now: Date }) {
  const { M, S } = useMoney();

  /* Investments */
  const manualMarket = useMemo(() => t.investments.filter((i) => i.type === 'stocks' || i.type === 'mutual-fund'), [t.investments]);
  const inv = useMemo(() => investmentSummary({ stocks: t.stocks, funds: t.funds, manualMarket, marketLive }), [t.stocks, t.funds, manualMarket, marketLive]);
  const holdings = useMemo(
    () =>
      [...t.stocks.map((s: any) => ({ name: s.tradingsymbol, q: s.quantity, lp: s.last_price, ap: s.average_price })), ...t.funds.map((f: any) => ({ name: f.fund_name || f.tradingsymbol, q: f.quantity, lp: f.last_price, ap: f.average_price }))]
        .map((h) => ({ name: h.name as string, value: (h.lp || 0) * (h.q || 0), cost: h.ap ? h.ap * (h.q || 0) : null }))
        .sort((a, b) => b.value - a.value),
    [t.stocks, t.funds],
  );

  /* Cash flow: last six months, each checked on its own */
  const months = useMemo(() => {
    const out: { key: string; r: ReturnType<typeof cashFlowForMonth> }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      out.push({ key, r: cashFlowForMonth(transactions, key, i === 0) });
    }
    return out;
  }, [transactions, now]);
  const reliable = months.filter((m) => m.r.status === 'ok');
  /** The first month that has transactions but can't be classified explains why history is unavailable */
  const blocker = months.map((m) => (m.r.status === 'unavailable' && !m.r.reason.startsWith('No transactions') ? m.r.reason : null)).find(Boolean);

  /* Debt: lender statements */
  const { data: loanSnaps } = useQuery({ queryKey: ['loan-analytics-snapshots'], queryFn: fetchLoanSnapshots });
  const byLoan = useMemo(() => {
    const map = new Map<string, { year: number; month: number; outstanding: number; principal: number; interest: number }[]>();
    for (const { snapshot: s } of loanSnaps?.snapshots ?? []) {
      const list = map.get(s.loanId) ?? [];
      list.push({ year: Number(s.year), month: Number(s.month), outstanding: s.outstandingAmount, principal: s.principalPaid, interest: s.interestPaid });
      map.set(s.loanId, list);
    }
    for (const l of map.values()) l.sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month));
    return map;
  }, [loanSnaps]);

  return (
    <>
      <Panel className="mt-4" id="investments">
        <PanelHeader title="Investment returns" subtitle={`Scope: ${inv.holdings} broker-held stocks & funds${marketLive === false ? ' · last synced prices' : ''}`} />
        {inv.holdings === 0 ? (
          <Limitation>No broker holdings with prices and average cost — returns can&apos;t be calculated. Recorded market value: {M(t.byKey.stocks.value)}.</Limitation>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-[13px] text-muted">Market value</dt>
                <dd className="text-[19px] font-bold tabular-nums">{M(inv.marketValue)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Cost basis (average price × quantity)</dt>
                <dd className="text-[19px] font-bold tabular-nums">{inv.cost != null ? M(inv.cost) : 'Incomplete'}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Unrealised gain · lifetime</dt>
                <dd className={cn('text-[19px] font-bold tabular-nums', inv.unrealised != null && (inv.unrealised >= 0 ? 'text-gain' : 'text-loss'))}>
                  {inv.unrealised != null ? `${S(inv.unrealised)}${inv.unrealisedPct != null ? ` (${inv.unrealisedPct >= 0 ? '+' : '−'}${Math.abs(inv.unrealisedPct).toFixed(1)}%)` : ''}` : '—'}
                </dd>
              </div>
            </dl>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-[13.5px]">
                <thead>
                  <tr className="text-left text-[12.5px] text-muted">
                    <th className="py-1.5 font-medium">Holding</th>
                    <th className="py-1.5 text-right font-medium">Market value</th>
                    <th className="py-1.5 text-right font-medium">Cost</th>
                    <th className="py-1.5 text-right font-medium">Unrealised · lifetime</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.slice(0, 8).map((h) => (
                    <tr key={h.name} className="border-t border-divider">
                      <td className="py-1.5">{h.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{M(h.value)}</td>
                      <td className="py-1.5 text-right tabular-nums">{h.cost != null ? M(h.cost) : '—'}</td>
                      <td className={cn('py-1.5 text-right tabular-nums', h.cost != null && (h.value - h.cost >= 0 ? 'text-gain' : 'text-loss'))}>{h.cost != null ? S(h.value - h.cost) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {holdings.length > 8 && <p className="mt-1 text-[12px] text-muted">Top 8 of {holdings.length} by value · all holdings in Portfolio → Stocks &amp; funds.</p>}
            </div>
            <div className="mt-3 space-y-1">
              <Limitation>
                These are lifetime gains since purchase, not returns for the selected period. A period return needs purchase, sale and withdrawal history for these holdings, which isn&apos;t
                recorded — so contributions can&apos;t be separated from market gains.
              </Limitation>
              {inv.manualCount > 0 && (
                <Limitation>
                  Not in scope: {inv.manualCount} manually recorded stock/fund record{inv.manualCount === 1 ? '' : 's'} ({M(inv.manualValue)}), included in Stocks &amp; funds at their
                  recorded value but with no market price or cost tracking.
                </Limitation>
              )}
            </div>
          </>
        )}
      </Panel>

      <Panel className="mt-4" id="cash-flow">
        <PanelHeader title="Cash-flow history" subtitle="Income, spending and loan payments by month, where transactions can be classified" />
        {reliable.length === 0 ? (
          <Limitation>
            Not available yet. {blocker ?? 'No transactions are recorded for the last six months.'}{' '}
            Prerequisite: categorised bank transactions for whole months, with transfers, loan disbursements and investment purchases tagged. Cash flow is never inferred from asset
            snapshots.
          </Limitation>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead>
                <tr className="text-left text-[12.5px] text-muted">
                  <th className="py-1.5 font-medium">Month</th>
                  <th className="py-1.5 text-right font-medium">Income</th>
                  <th className="py-1.5 text-right font-medium">Spending</th>
                  <th className="py-1.5 text-right font-medium">Loan payments</th>
                  <th className="py-1.5 text-right font-medium">Surplus / deficit</th>
                </tr>
              </thead>
              <tbody>
                {months.map(({ key, r }) => (
                  <tr key={key} className="border-t border-divider">
                    <td className="py-1.5">
                      {monthLabel(key)}
                      {r.status === 'ok' && r.flow.partial && <span className="text-muted"> · partial</span>}
                    </td>
                    {r.status === 'ok' ? (
                      <>
                        <td className="py-1.5 text-right tabular-nums">{M(r.flow.income)}</td>
                        <td className="py-1.5 text-right tabular-nums">{M(r.flow.spending)}</td>
                        <td className="py-1.5 text-right tabular-nums">{M(r.flow.loanPayments)}</td>
                        <td className={cn('py-1.5 text-right tabular-nums', r.flow.surplus >= 0 ? 'text-gain' : 'text-loss')}>{S(r.flow.surplus)}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="py-1.5 text-right text-[12.5px] text-muted">
                        Not reliable: {r.reason}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-muted">Transfers, loan proceeds and investment purchases excluded. Spending excludes loan payments (principal and interest aren&apos;t split).</p>
          </div>
        )}
      </Panel>

      <Panel className="mt-4" id="debt">
        <PanelHeader title="Debt repayment history" subtitle="From lender statements on file" />
        {byLoan.size === 0 ? (
          <Limitation>
            No lender statements on file, so repayment history (principal vs interest by month) isn&apos;t available. Loan records hold only the current outstanding balance. Prerequisite:
            fetch or upload statements in Loans.
          </Limitation>
        ) : (
          <div className="space-y-4">
            {t.loans.filter((l) => byLoan.has(l.id)).map((l) => (
              <div key={l.id} className="overflow-x-auto">
                <h3 className="text-[14.5px] font-semibold">{l.name}</h3>
                <table className="mt-1 w-full min-w-[460px] text-[13.5px]">
                  <thead>
                    <tr className="text-left text-[12.5px] text-muted">
                      <th className="py-1.5 font-medium">Statement month</th>
                      <th className="py-1.5 text-right font-medium">Outstanding</th>
                      <th className="py-1.5 text-right font-medium">Principal repaid</th>
                      <th className="py-1.5 text-right font-medium">Interest paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byLoan.get(l.id)!.slice(0, 12).map((s) => (
                      <tr key={`${s.year}-${s.month}`} className="border-t border-divider">
                        <td className="py-1.5">{fmtDate(new Date(s.year, s.month, 0))}</td>
                        <td className="py-1.5 text-right tabular-nums">{M(s.outstanding)}</td>
                        <td className="py-1.5 text-right tabular-nums">{M(s.principal)}</td>
                        <td className="py-1.5 text-right tabular-nums">{M(s.interest)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <p className="text-[12px] text-muted">Principal repaid reduces both cash and the loan balance, so it does not change net worth; interest is a cost.</p>
          </div>
        )}
      </Panel>
    </>
  );
}
