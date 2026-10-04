'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Search } from 'lucide-react';
import { Dot, Panel, ShareBar, UnderlineTabs } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, pct, fmtDate } from '@/shared/hooks/useMoney';
import { usePortfolioTotals, receivableExpected, type AssetClassKey } from '@/shared/hooks/usePortfolioTotals';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';

type Filter = 'all' | AssetClassKey | 'loans';

interface Holding {
  id: string;
  name: string;
  sub: string;
  cls: AssetClassKey | 'loans';
  value: number;
  /** unrealised gain / appreciation where it is known */
  gain?: number;
}

const titleCase = (v: string) => v.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
const accountType = (v: string) => (v === 'fd' || v === 'rd' ? v.toUpperCase() : titleCase(v));

/**
 * Read-only list of everything in net worth — one row per account, holding or record, across
 * every asset class plus loans. Rows open the class page, where records are added and edited.
 */
export function PortfolioHoldings() {
  const t = usePortfolioTotals();
  const router = useRouter();
  const { M, S } = useMoney();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const holdings = useMemo<Holding[]>(() => {
    const rows: Holding[] = [];
    for (const b of t.cashAccounts)
      rows.push({ id: `b-${b.id}`, name: b.bankName, sub: [accountType(b.accountType), b.accountNumber && `••${b.accountNumber.slice(-4)}`].filter(Boolean).join(' · '), cls: 'bank', value: b.balance || 0 });
    for (const s of t.stocks)
      rows.push({ id: `s-${s.tradingsymbol}-${s.exchange}`, name: s.tradingsymbol, sub: `Stock · ${s.quantity} shares`, cls: 'stocks', value: (s.last_price || 0) * (s.quantity || 0), gain: s.pnl });
    for (const f of t.funds)
      rows.push({ id: `f-${f.tradingsymbol}-${f.folio}`, name: f.fund_name || f.tradingsymbol, sub: 'Mutual fund', cls: 'stocks', value: (f.last_price || 0) * (f.quantity || 0), gain: f.pnl });
    for (const i of t.investments) {
      if (i.status === 'closed' || t.retirementInvestments.includes(i)) continue;
      const market = i.type === 'stocks' || i.type === 'mutual-fund';
      const value = getCurrentInvestmentValue(i);
      rows.push({
        id: `i-${i.id}`,
        name: i.name,
        sub: [titleCase(i.type === 'fd' ? 'Fixed deposit' : i.type === 'ppf' ? 'PPF' : i.type), i.maturityDate && `matures ${fmtDate(i.maturityDate)}`].filter(Boolean).join(' · '),
        cls: market ? 'stocks' : 'investments',
        value,
        gain: value - (i.amount || 0),
      });
    }
    for (const p of t.ppfAccounts) rows.push({ id: `p-${p.id}`, name: p.establishmentName || 'Provident fund', sub: 'EPF passbook', cls: 'pf', value: p.grandTotal || 0 });
    for (const i of t.retirementInvestments) {
      const value = getCurrentInvestmentValue(i);
      rows.push({ id: `r-${i.id}`, name: i.name, sub: i.type === 'nps' ? 'NPS' : i.type === 'epf' ? 'Provident fund' : 'Retirement', cls: 'pf', value, gain: value - (i.amount || 0) });
    }
    for (const p of t.properties) {
      const value = p.currentValue || p.purchasePrice || 0;
      rows.push({ id: `pr-${p.id}`, name: p.name, sub: [titleCase(p.type), p.location].filter(Boolean).join(' · '), cls: 'property', value, gain: p.purchasePrice ? value - p.purchasePrice : undefined });
    }
    for (const r of t.receivables) {
      const { total, interest } = receivableExpected(r);
      rows.push({ id: `rc-${r.id}`, name: r.bankName, sub: r.dueDate ? `Due ${fmtDate(r.dueDate)}` : 'No due date', cls: 'recv', value: total, gain: interest || undefined });
    }
    for (const l of t.loans)
      rows.push({ id: `l-${l.id}`, name: l.name, sub: `${titleCase(l.type)} · EMI ${M(l.emiAmount)}`, cls: 'loans', value: l.outstandingAmount || 0 });
    return rows;
  }, [t.cashAccounts, t.stocks, t.funds, t.investments, t.retirementInvestments, t.ppfAccounts, t.properties, t.receivables, t.loans, M]);

  const meta = (cls: Holding['cls']) =>
    cls === 'loans' ? { label: 'Loans', color: 'var(--c-loan)', href: '/portfolio/loans' } : { label: t.byKey[cls].label, color: t.byKey[cls].color, href: t.byKey[cls].href };

  const q = query.trim().toLowerCase();
  const visible = holdings.filter(
    (h) => (filter === 'all' ? h.cls !== 'loans' : h.cls === filter) && (!q || h.name.toLowerCase().includes(q) || h.sub.toLowerCase().includes(q)),
  );
  const count = (f: Filter) => holdings.filter((h) => (f === 'all' ? h.cls !== 'loans' : h.cls === f)).length;
  const isLoans = filter === 'loans';
  const base = isLoans ? t.liabilities : t.assets;

  return (
    <Panel flush className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 px-6 pb-2 pt-[22px]">
        <div>
          <h2 className="text-[19px]">Holdings</h2>
          <p className="mt-1 text-[13px] text-muted">Everything counted in net worth · read-only here — tap a row to manage it on its page</p>
        </div>
        <label className="relative w-full max-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search holdings…" className="input !pl-9" aria-label="Search holdings" />
        </label>
      </div>
      <UnderlineTabs<Filter>
        className="px-6"
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'all', label: 'All assets', count: count('all') },
          ...t.classes.map((c) => ({ value: c.key as Filter, label: c.label, count: count(c.key) })),
          { value: 'loans', label: 'Loans', count: count('loans') },
        ]}
      />
      <DataTable<Holding>
        key={filter}
        rows={visible}
        rowKey={(h) => h.id}
        onRowClick={(h) => router.push(meta(h.cls).href)}
        defaultSort={{ key: 'value', dir: 'desc' }}
        empty={q ? 'No holdings match your search.' : 'Nothing here yet — add records from the class page in the sidebar.'}
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
          ...(filter === 'all'
            ? [
                {
                  key: 'class',
                  label: 'Class',
                  sortValue: (h: Holding) => meta(h.cls).label,
                  render: (h: Holding) => (
                    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[14px]">
                      <Dot color={meta(h.cls).color} size={8} />
                      {meta(h.cls).label}
                    </span>
                  ),
                },
              ]
            : []),
          {
            key: 'value',
            label: isLoans ? 'Outstanding' : 'Value',
            align: 'right',
            sortValue: (h) => h.value,
            render: (h) => <span className={`font-semibold ${isLoans ? 'text-loss' : ''}`}>{M(h.value)}</span>,
          },
          ...(isLoans
            ? []
            : [
                {
                  key: 'gain',
                  label: 'Gain',
                  align: 'right' as const,
                  sortValue: (h: Holding) => h.gain ?? 0,
                  render: (h: Holding) =>
                    h.gain == null || Math.abs(h.gain) < 0.5 ? <span className="text-muted">—</span> : <span className={h.gain >= 0 ? 'text-gain' : 'text-loss'}>{S(h.gain)}</span>,
                },
              ]),
          {
            key: 'share',
            label: isLoans ? 'Of liabilities' : 'Of assets',
            align: 'right',
            sortValue: (h) => h.value,
            render: (h) => {
              const share = base > 0 ? (h.value / base) * 100 : 0;
              return (
                <span className="flex items-center justify-end gap-2.5">
                  <ShareBar value={share} color={meta(h.cls).color} className="hidden w-16 sm:block" />
                  <span className="w-12 text-right tabular-nums text-muted">{pct(share)}</span>
                </span>
              );
            },
          },
          {
            key: 'go',
            label: '',
            render: (h) => (
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] text-muted" title={`Manage in ${meta(h.cls).label}`}>
                <ArrowUpRight className="h-4 w-4" />
              </span>
            ),
          },
        ]}
      />
    </Panel>
  );
}
