'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, RotateCcw, Search } from 'lucide-react';
import { Dot, LinkButton, Panel, Segmented, ShareBar, UnderlineTabs } from '@/shared/components/ui';
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

/**
 * Portfolio overview body (read-only). A filter row — asset classes (multi-select), gainers /
 * losers, minimum value — drives the summary and the two charts. The holdings table below is
 * tab-per-class (plus Loans) with its own search; rows open the class page to manage a record.
 */
export function PortfolioExplorer() {
  const t = usePortfolioTotals();
  const holdings = useHoldings();
  const { M, S } = useMoney();

  const [classes, setClasses] = useState<AssetClassKey[]>([]);
  const [perf, setPerf] = useState<Perf>('all');
  const [minValue, setMinValue] = useState('0');

  const min = Number(minValue);
  const passesOthers = (h: Holding) => (perf === 'all' || (perf === 'gainers' ? gainOf(h) > 0.5 : gainOf(h) < -0.5)) && h.value >= min;
  const visible = holdings.filter((h) => (classes.length === 0 || classes.includes(h.cls)) && passesOthers(h));

  const filtered = classes.length > 0 || perf !== 'all' || min > 0;
  const reset = () => {
    setClasses([]);
    setPerf('all');
    setMinValue('0');
  };

  const total = visible.reduce((s, h) => s + h.value, 0);
  const invested = visible.reduce((s, h) => s + h.invested, 0);
  const gain = total - invested;
  const top = [...visible].sort((a, b) => b.value - a.value).slice(0, 8);
  const selectionLabel = classes.length === 1 ? t.byKey[classes[0]!].label.toLowerCase() : 'holdings';

  const stat = (label: string, value: React.ReactNode, tone = 'text-ink') => (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={cn('mt-1.5 text-[19px] font-bold tabular-nums tracking-[-0.01em]', tone)}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <ClassMultiSelect
            options={t.classes.map((c) => ({ value: c.key, label: c.label, color: c.color, count: holdings.filter((h) => h.cls === c.key && passesOthers(h)).length }))}
            value={classes}
            onChange={setClasses}
          />
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
              Reset
            </button>
          )}
          <span className="ml-auto text-[13px] text-muted">Filters apply to the summary and charts</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-divider pt-4 md:grid-cols-4">
          {stat('Holdings', `${visible.length} of ${holdings.length}`)}
          {stat('Value', M(total))}
          {stat('Invested', M(invested))}
          {stat(
            'Gain',
            <>
              {S(gain)}
              {invested > 0 && <span className="ml-1.5 text-[13px] font-semibold">({((gain / invested) * 100).toFixed(1)}%)</span>}
            </>,
            Math.abs(gain) < 0.5 ? 'text-ink' : gain > 0 ? 'text-gain' : 'text-loss',
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

      <HoldingsTable holdings={holdings} />
    </div>
  );
}

type Tab = AssetClassKey | 'loans';

/** Read-only holdings, one tab per asset class plus Loans, with search — independent of the chart filters. */
function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const t = usePortfolioTotals();
  const { M, S } = useMoney();
  const [query, setQuery] = useState('');

  const loans = useMemo<Holding[]>(
    () => t.loans.map((l) => ({ id: `l-${l.id}`, name: l.name, sub: `${titleCase(l.type)} · EMI ${M(l.emiAmount)} · ${l.interestRate}%`, cls: 'bank' as AssetClassKey, invested: l.principalAmount || 0, value: l.outstandingAmount || 0 })),
    [t.loans, M],
  );
  const rowsFor = (tab: Tab) => (tab === 'loans' ? loans : holdings.filter((h) => h.cls === tab));
  // Open on the first class that has something in it
  const [tab, setTab] = useState<Tab | null>(null);
  const active: Tab = tab ?? t.classes.find((c) => holdings.some((h) => h.cls === c.key))?.key ?? 'bank';
  const isLoans = active === 'loans';
  const meta = isLoans ? { label: 'Loans', color: 'var(--c-loan)', href: '/portfolio/loans' } : t.byKey[active];

  const q = query.trim().toLowerCase();
  const all = rowsFor(active);
  const rows = all.filter((h) => !q || h.name.toLowerCase().includes(q) || h.sub.toLowerCase().includes(q));
  const base = all.reduce((s, h) => s + h.value, 0);

  return (
    <Panel flush className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 px-6 pb-2 pt-[22px]">
        <div>
          <h2 className="text-[19px]">Holdings</h2>
          <p className="mt-1 text-[13px] text-muted">Read-only · add, edit or delete on the {meta.label} page</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="relative min-w-0 flex-1 sm:w-[260px] sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${meta.label.toLowerCase()}…`} className="input !pl-9" aria-label="Search holdings" />
          </label>
          {/* One way out to the class page that owns these records, instead of an arrow on every row */}
          <LinkButton href={meta.href} variant="secondary" icon={ArrowUpRight}>
            View details<span className="sr-only"> for {meta.label}</span>
          </LinkButton>
        </div>
      </div>
      <UnderlineTabs<Tab>
        className="px-6"
        value={active}
        onChange={setTab}
        tabs={[...t.classes.map((c) => ({ value: c.key as Tab, label: c.label, count: rowsFor(c.key).length })), { value: 'loans' as Tab, label: 'Loans', count: loans.length }]}
      />
      <DataTable<Holding>
        key={active}
        rows={rows}
        rowKey={(h) => h.id}
        defaultSort={{ key: 'value', dir: 'desc' }}
        empty={q ? 'Nothing matches your search.' : `Nothing in ${meta.label} yet — add it from the ${meta.label} page.`}
        columns={[
          {
            key: 'name',
            label: isLoans ? 'Loan' : 'Holding',
            sortValue: (h) => h.name.toLowerCase(),
            render: (h) => (
              <>
                <div className="max-w-[320px] truncate font-semibold">{h.name}</div>
                <div className="max-w-[320px] truncate text-[12.5px] text-muted">{h.sub}</div>
              </>
            ),
          },
          { key: 'invested', label: isLoans ? 'Principal' : 'Invested', align: 'right', sortValue: (h) => h.invested, render: (h) => M(h.invested) },
          {
            key: 'value',
            label: isLoans ? 'Outstanding' : 'Value',
            align: 'right',
            sortValue: (h) => h.value,
            render: (h) => <span className={cn('font-semibold', isLoans && 'text-loss')}>{M(h.value)}</span>,
          },
          ...(isLoans
            ? [
                {
                  key: 'repaid',
                  label: 'Repaid',
                  align: 'right' as const,
                  sortValue: (h: Holding) => h.invested - h.value,
                  render: (h: Holding) => <span className="text-gain">{M(Math.max(0, h.invested - h.value))}</span>,
                },
              ]
            : [
                {
                  key: 'gain',
                  label: 'Gain',
                  align: 'right' as const,
                  sortValue: gainOf,
                  render: (h: Holding) => {
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
              ]),
          {
            key: 'share',
            label: isLoans ? 'Of loans' : `Of ${meta.label.toLowerCase()}`,
            align: 'right',
            sortValue: (h) => h.value,
            render: (h) => {
              const share = base > 0 ? (h.value / base) * 100 : 0;
              return (
                <span className="flex items-center justify-end gap-2.5">
                  <ShareBar value={share} color={meta.color} className="hidden w-16 sm:block" />
                  <span className="w-12 text-right tabular-nums text-muted">{pct(share)}</span>
                </span>
              );
            },
          },
        ]}
      />
    </Panel>
  );
}

/** Dropdown with a checkbox per asset class; nothing ticked means every class. */
function ClassMultiSelect({
  options,
  value,
  onChange,
}: {
  options: { value: AssetClassKey; label: string; color: string; count: number }[];
  value: AssetClassKey[];
  onChange: (v: AssetClassKey[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const picked = options.filter((o) => value.includes(o.value));
  const label = picked.length === 0 ? 'All asset classes' : picked.length <= 2 ? picked.map((o) => o.label).join(', ') : `${picked.length} asset classes`;
  const toggle = (k: AssetClassKey) => onChange(value.includes(k) ? value.filter((v) => v !== k) : [...value, k]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} className="input !inline-flex !w-auto min-w-[220px] items-center gap-2 text-left">
        {picked.length > 0 && picked.length <= 3 && (
          <span className="flex -space-x-0.5">
            {picked.map((o) => (
              <Dot key={o.value} color={o.color} size={8} />
            ))}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown className={cn('h-4 w-4 flex-none text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable="true" className="absolute left-0 z-30 mt-1.5 w-[280px] rounded-xl bg-[var(--dialog-bg)] p-1.5 shadow-[var(--shadow-md)] ring-1 ring-divider">
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] hover:bg-tile">
                <span className={cn('flex h-4 w-4 flex-none items-center justify-center rounded border', on ? 'border-accent bg-accent text-white' : 'border-divider')}>
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <Dot color={o.color} size={8} />
                <span className="flex-1">{o.label}</span>
                <span className="text-[12px] tabular-nums text-muted">{o.count}</span>
              </button>
            );
          })}
          <div className="mt-1 flex justify-between border-t border-divider px-2.5 pt-2 pb-1 text-[13px]">
            <button type="button" className="font-medium text-accent-700 hover:underline" onClick={() => onChange(options.map((o) => o.value))}>
              Select all
            </button>
            <button type="button" className="font-medium text-muted hover:underline" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
