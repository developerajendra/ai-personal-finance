'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, RotateCcw, Search } from 'lucide-react';
import { Dot, Panel, Segmented, ShareBar } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, pct, fmtDate } from '@/shared/hooks/useMoney';
import { usePortfolioTotals, receivableExpected, isFixedDeposit, type AssetClassKey } from '@/shared/hooks/usePortfolioTotals';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';
import { cn } from '@/shared/utils/cn';
import { BarsPanel, DonutPanel, toSlices } from './ClassCharts';

interface Holding {
  id: string;
  name: string;
  sub: string;
  cls: AssetClassKey;
  invested: number;
  value: number;
}

type Perf = 'all' | 'gainers' | 'losers';
const MIN_VALUES = [
  { value: '0', label: 'Any value' },
  { value: '10000', label: '₹10K and above' },
  { value: '100000', label: '₹1L and above' },
  { value: '1000000', label: '₹10L and above' },
];

const titleCase = (v: string) => v.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
const accountType = (v: string) => (v === 'fd' || v === 'rd' ? v.toUpperCase() : titleCase(v));
const gainOf = (h: Holding) => h.value - h.invested;

/** Every asset in net worth as one row — account, holding or record — with what was put in and what it is worth. */
function useHoldings(): Holding[] {
  const t = usePortfolioTotals();
  return useMemo(() => {
    const rows: Holding[] = [];
    for (const b of t.cashAccounts) {
      const v = b.balance || 0;
      rows.push({ id: `b-${b.id}`, name: b.bankName, sub: [accountType(b.accountType), b.accountNumber && `••${b.accountNumber.slice(-4)}`].filter(Boolean).join(' · '), cls: 'bank', invested: v, value: v });
    }
    for (const s of t.stocks)
      rows.push({ id: `s-${s.tradingsymbol}-${s.exchange}`, name: s.tradingsymbol, sub: `Stock · ${s.quantity} shares`, cls: 'stocks', invested: (s.average_price || 0) * (s.quantity || 0), value: (s.last_price || 0) * (s.quantity || 0) });
    for (const f of t.funds)
      rows.push({ id: `f-${f.tradingsymbol}-${f.folio}`, name: f.fund_name || f.tradingsymbol, sub: 'Mutual fund', cls: 'stocks', invested: (f.average_price || 0) * (f.quantity || 0), value: (f.last_price || 0) * (f.quantity || 0) });
    for (const i of t.investments) {
      if (i.status === 'closed' || t.retirementInvestments.includes(i)) continue;
      const market = i.type === 'stocks' || i.type === 'mutual-fund';
      const label = i.type === 'fd' ? 'Fixed deposit' : i.type === 'ppf' ? 'PPF' : titleCase(i.type);
      rows.push({
        id: `i-${i.id}`,
        name: i.name,
        sub: [label, i.interestRate != null && `${i.interestRate}%`, i.maturityDate && `matures ${fmtDate(i.maturityDate)}`].filter(Boolean).join(' · '),
        cls: market ? 'stocks' : isFixedDeposit(i) ? 'fd' : 'investments',
        invested: i.amount || 0,
        value: getCurrentInvestmentValue(i),
      });
    }
    for (const p of t.ppfAccounts) {
      const net = (p.depositEmployeeShare || 0) - (p.withdrawEmployeeShare || 0) + (p.depositEmployerShare || 0) - (p.withdrawEmployerShare || 0) + (p.pensionContribution || 0);
      const v = p.grandTotal || 0;
      rows.push({ id: `p-${p.id}`, name: p.establishmentName || 'Provident fund', sub: 'EPF passbook', cls: 'pf', invested: Math.min(net, v), value: v });
    }
    for (const i of t.retirementInvestments)
      rows.push({ id: `r-${i.id}`, name: i.name, sub: i.type === 'nps' ? 'NPS' : i.type === 'epf' ? 'Provident fund' : 'Retirement', cls: 'pf', invested: i.amount || 0, value: getCurrentInvestmentValue(i) });
    for (const p of t.properties) {
      const v = p.currentValue || p.purchasePrice || 0;
      rows.push({ id: `pr-${p.id}`, name: p.name, sub: [titleCase(p.type), p.location].filter(Boolean).join(' · '), cls: 'property', invested: p.purchasePrice || v, value: v });
    }
    for (const r of t.receivables) {
      const { total, principal } = receivableExpected(r);
      rows.push({ id: `rc-${r.id}`, name: r.bankName, sub: r.dueDate ? `Lent · due ${fmtDate(r.dueDate)}` : 'Lent · no due date', cls: 'recv', invested: principal, value: total });
    }
    return rows;
  }, [t.cashAccounts, t.stocks, t.funds, t.investments, t.retirementInvestments, t.ppfAccounts, t.properties, t.receivables]);
}

/**
 * Portfolio overview body (read-only): filters — asset classes, search, gainers / losers, minimum
 * value — drive the two charts and the holdings table together. Rows open the class page where
 * the record is managed.
 */
export function PortfolioExplorer() {
  const t = usePortfolioTotals();
  const holdings = useHoldings();
  const router = useRouter();
  const { M, S } = useMoney();

  const [classes, setClasses] = useState<AssetClassKey[]>([]);
  const [query, setQuery] = useState('');
  const [perf, setPerf] = useState<Perf>('all');
  const [minValue, setMinValue] = useState('0');

  const q = query.trim().toLowerCase();
  const min = Number(minValue);
  // Class counts ignore the class filter itself, so each chip shows what picking it would add
  const passesOthers = (h: Holding) =>
    (!q || h.name.toLowerCase().includes(q) || h.sub.toLowerCase().includes(q)) &&
    (perf === 'all' || (perf === 'gainers' ? gainOf(h) > 0.5 : gainOf(h) < -0.5)) &&
    h.value >= min;
  const visible = holdings.filter((h) => (classes.length === 0 || classes.includes(h.cls)) && passesOthers(h));
  const countFor = (k: AssetClassKey) => holdings.filter((h) => h.cls === k && passesOthers(h)).length;

  const filtered = classes.length > 0 || !!q || perf !== 'all' || min > 0;
  const reset = () => {
    setClasses([]);
    setQuery('');
    setPerf('all');
    setMinValue('0');
  };
  const toggle = (k: AssetClassKey) => setClasses((cur) => (cur.includes(k) ? cur.filter((c) => c !== k) : [...cur, k]));

  const total = visible.reduce((s, h) => s + h.value, 0);
  const invested = visible.reduce((s, h) => s + h.invested, 0);
  const gain = total - invested;
  const cls = (k: AssetClassKey) => t.byKey[k];

  const ranked = [...visible].sort((a, b) => b.value - a.value);
  const top = ranked.slice(0, 8);
  const selectionLabel = classes.length === 1 ? cls(classes[0]!).label.toLowerCase() : 'holdings';

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[19px]">Filter holdings</h2>
            <p className="mt-1 text-[13px] text-muted">Charts and the table below follow these filters</p>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[13px] text-muted">
            <span>
              <span className="font-semibold text-ink">{visible.length}</span> of {holdings.length} holdings
            </span>
            <span>
              Value <span className="font-semibold tabular-nums text-ink">{M(total)}</span>
            </span>
            <span>
              Invested <span className="font-semibold tabular-nums text-ink">{M(invested)}</span>
            </span>
            <span>
              Gain{' '}
              <span className={cn('font-semibold tabular-nums', Math.abs(gain) < 0.5 ? 'text-ink' : gain > 0 ? 'text-gain' : 'text-loss')}>
                {S(gain)}
                {invested > 0 && ` (${((gain / invested) * 100).toFixed(1)}%)`}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Asset classes">
          <Chip on={classes.length === 0} onClick={() => setClasses([])}>
            All classes
          </Chip>
          {t.classes.map((c) => (
            <Chip key={c.key} on={classes.includes(c.key)} onClick={() => toggle(c.key)}>
              <Dot color={c.color} size={8} />
              {c.label}
              <span className="text-[12px] tabular-nums opacity-70">{countFor(c.key)}</span>
            </Chip>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="relative min-w-[200px] flex-1 sm:max-w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, type, bank…" className="input !pl-9" aria-label="Search holdings" />
          </label>
          <Segmented<Perf>
            ariaLabel="Performance"
            value={perf}
            onChange={setPerf}
            options={[
              { value: 'all', label: 'All' },
              { value: 'gainers', label: 'Gainers' },
              { value: 'losers', label: 'Losers' },
            ]}
          />
          <select value={minValue} onChange={(e) => setMinValue(e.target.value)} className="input !w-auto" aria-label="Minimum value">
            {MIN_VALUES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {filtered && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent-700 hover:underline">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset filters
            </button>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <DonutPanel title={`Top ${selectionLabel}`} subtitle="Share of current value" slices={toSlices(visible.map((h) => ({ name: h.name, value: h.value })))} centreLabel="Value" />
        <BarsPanel
          title="Invested vs current value"
          subtitle={visible.length > top.length ? `Largest ${top.length} of ${visible.length} ${selectionLabel}` : 'What was put in and what it is worth today'}
          rows={top.map((h) => ({ name: h.name, invested: h.invested, current: h.value }))}
          series={[
            { key: 'invested', label: 'Invested', color: 'var(--c-ret)' },
            { key: 'current', label: 'Current value', color: 'var(--color-accent)' },
          ]}
        />
      </div>

      <Panel flush className="overflow-hidden">
        <div className="px-6 pb-4 pt-[22px]">
          <h2 className="text-[19px]">Holdings</h2>
          <p className="mt-1 text-[13px] text-muted">Read-only · tap a row to manage it on its page · loans are on the Loans page</p>
        </div>
        <DataTable<Holding>
          rows={visible}
          rowKey={(h) => h.id}
          onRowClick={(h) => router.push(cls(h.cls).href)}
          defaultSort={{ key: 'value', dir: 'desc' }}
          empty={filtered ? 'No holdings match these filters.' : 'Nothing here yet — add records from the class pages in the sidebar.'}
          columns={[
            {
              key: 'name',
              label: 'Holding',
              sortValue: (h) => h.name.toLowerCase(),
              render: (h) => (
                <>
                  <div className="max-w-[300px] truncate font-semibold">{h.name}</div>
                  <div className="max-w-[300px] truncate text-[12.5px] text-muted">{h.sub}</div>
                </>
              ),
            },
            {
              key: 'class',
              label: 'Class',
              sortValue: (h) => cls(h.cls).label,
              render: (h) => (
                <span className="inline-flex items-center gap-2 whitespace-nowrap text-[14px]">
                  <Dot color={cls(h.cls).color} size={8} />
                  {cls(h.cls).label}
                </span>
              ),
            },
            { key: 'invested', label: 'Invested', align: 'right', sortValue: (h) => h.invested, render: (h) => M(h.invested) },
            { key: 'value', label: 'Value', align: 'right', sortValue: (h) => h.value, render: (h) => <span className="font-semibold">{M(h.value)}</span> },
            {
              key: 'gain',
              label: 'Gain',
              align: 'right',
              sortValue: gainOf,
              render: (h) => {
                const g = gainOf(h);
                if (Math.abs(g) < 0.5) return <span className="text-muted">—</span>;
                return (
                  <span className={g > 0 ? 'text-gain' : 'text-loss'}>
                    {S(g)}
                    {h.invested > 0 && <span className="ml-1 text-[12.5px]">({((g / h.invested) * 100).toFixed(1)}%)</span>}
                  </span>
                );
              },
            },
            {
              key: 'share',
              label: filtered ? 'Of selection' : 'Of assets',
              align: 'right',
              sortValue: (h) => h.value,
              render: (h) => {
                const share = total > 0 ? (h.value / total) * 100 : 0;
                return (
                  <span className="flex items-center justify-end gap-2.5">
                    <ShareBar value={share} color={cls(h.cls).color} className="hidden w-16 sm:block" />
                    <span className="w-12 text-right tabular-nums text-muted">{pct(share)}</span>
                  </span>
                );
              },
            },
            {
              key: 'go',
              label: '',
              render: (h) => (
                <span className="inline-flex text-muted" title={`Manage in ${cls(h.cls).label}`}>
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn('btn !gap-2 !px-3 !py-1.5 text-[13.5px]', on ? 'bg-accent-100 text-accent-800 shadow-[inset_0_0_0_1px_var(--color-accent)]' : 'btn-secondary')}>
      {children}
    </button>
  );
}
