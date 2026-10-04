'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  BadgeIndianRupee,
  TrendingUp,
  PieChart,
  Landmark,
  HandCoins,
  Building2,
  Plus,
  EyeOff,
  Eye,
  Palette,
  FileText,
  Repeat,
  type LucideIcon,
} from 'lucide-react';
import { NAV, SEARCH_EXTRA } from '@/shared/components/navigation';
import { usePortfolioTotals, isRetirementInvestment } from '@/shared/hooks/usePortfolioTotals';
import { useMoney } from '@/shared/hooks/useMoney';
import { useTheme } from '@/shared/providers/ThemeProvider';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';
import { priceLabel, useSubscriptions } from '@/modules/subscriptions/useSubscriptions';

interface Result {
  key: string;
  label: string;
  sub: string;
  kind: string;
  icon: LucideIcon;
  run: () => void;
}

/** ⌘K — jump to a page, account, holding or person, or run a quick action (design: "Search"). */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const t = usePortfolioTotals();
  const { M } = useMoney();
  const { hidden, setHidden } = useTheme();
  const { all: subscriptions } = useSubscriptions();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const all: Result[] = useMemo(() => {
    const nav = (href: string) => () => router.push(href);
    return [
      ...Object.values(NAV).map((n) => ({ key: n.href, label: n.label, sub: 'Page', kind: 'Go to', icon: n.icon, run: nav(n.href) })),
      ...SEARCH_EXTRA.map((p) => ({ key: p.href, label: p.label, sub: p.group, kind: 'Go to', icon: FileText, run: nav(p.href) })),
      ...t.investments
        .filter((inv) => inv.status !== 'closed')
        .map((inv) => ({
          key: `inv-${inv.id}`,
          label: inv.name,
          sub: `${inv.type.replace('-', ' ')} · ${M(getCurrentInvestmentValue(inv))}`,
          kind: 'Record',
          icon: BadgeIndianRupee,
          run: nav(isRetirementInvestment(inv) ? '/portfolio/provident-fund' : '/portfolio/investments'),
        })),
      ...t.stocks.map((s: any) => ({
        key: `stk-${s.tradingsymbol}`,
        label: s.tradingsymbol,
        sub: `Stock · ${M((s.last_price || 0) * (s.quantity || 0))}`,
        kind: 'Holding',
        icon: TrendingUp,
        run: nav('/portfolio/stocks'),
      })),
      ...t.funds.map((f: any) => ({
        key: `mf-${f.folio}-${f.tradingsymbol}`,
        label: f.fund_name || f.tradingsymbol,
        sub: `Mutual fund · ${M((f.last_price || 0) * (f.quantity || 0))}`,
        kind: 'Holding',
        icon: PieChart,
        run: nav('/portfolio/mutual-funds'),
      })),
      ...t.cashAccounts.map((b) => ({
        key: `bank-${b.id}`,
        label: b.bankName,
        sub: `Bank account${b.accountNumber ? ` ••${b.accountNumber.slice(-4)}` : ''} · ${M(b.balance)}`,
        kind: 'Account',
        icon: Landmark,
        run: nav('/portfolio/bank-balances'),
      })),
      ...t.receivables.map((r) => ({ key: `recv-${r.id}`, label: r.bankName, sub: `Receivable · ${M(r.balance)}`, kind: 'Person', icon: HandCoins, run: nav('/portfolio/receivables') })),
      ...t.properties.map((p) => ({ key: `prop-${p.id}`, label: p.name, sub: `${p.type}${p.location ? ` · ${p.location}` : ''}`, kind: 'Property', icon: Building2, run: nav('/portfolio/properties') })),
      ...subscriptions.map((s) => ({
        key: `sub-${s.id}`,
        label: s.name,
        sub: `Subscription · ${priceLabel(s)}${s.status === 'Cancelled' ? ' · cancelled' : ''}`,
        kind: 'Record',
        icon: Repeat,
        run: nav('/subscriptions'),
      })),
      { key: 'act-budget', label: 'Add budget item', sub: 'Action', kind: 'Action', icon: Plus, run: nav('/budget') },
      { key: 'act-privacy', label: hidden ? 'Show amounts' : 'Toggle privacy mode', sub: hidden ? 'Reveal hidden amounts' : 'Hide or show amounts', kind: 'Action', icon: hidden ? Eye : EyeOff, run: () => setHidden(!hidden) },
      { key: 'act-theme', label: 'Change appearance', sub: 'Theme and accent colour', kind: 'Action', icon: Palette, run: nav('/settings') },
    ];
  }, [t.investments, t.stocks, t.funds, t.cashAccounts, t.receivables, t.properties, subscriptions, M, hidden, setHidden, router]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (term ? all.filter((r) => `${r.label} ${r.sub}`.toLowerCase().includes(term)) : all.slice(0, 9)).slice(0, 10);
  }, [q, all]);

  useEffect(() => {
    if (open) {
      setQ('');
      setI(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep the highlighted row in view while arrowing
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [i]);

  if (!open) return null;

  const run = (r: Result) => {
    onClose();
    r.run();
  };
  const cur = Math.min(i, Math.max(0, results.length - 1));

  return (
    <div className="cmdk-overlay fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="cmdk pop-in">
        <div className="cmdk-head">
          <Search className="h-5 w-5 flex-none text-neutral-700" strokeWidth={1.75} />
          <input
            ref={inputRef}
            aria-label="Search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setI((x) => Math.min(x + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setI((x) => Math.max(x - 1, 0));
              } else if (e.key === 'Enter' && results[cur]) {
                e.preventDefault();
                run(results[cur]!);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Jump to a page, account, holding or person…"
            className="cmdk-input"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="cmdk-kbd" onClick={onClose} aria-label="Close search">
            Esc
          </button>
        </div>
        <div ref={listRef} className="cmdk-list" role="listbox" aria-label="Results">
          {results.length === 0 && <div className="px-3 py-[22px] text-[14px] text-neutral-700">Nothing matches “{q}”.</div>}
          {results.map((r, idx) => {
            const Icon = r.icon;
            return (
              <button
                key={r.key}
                type="button"
                data-idx={idx}
                role="option"
                aria-selected={idx === cur}
                onMouseMove={() => idx !== cur && setI(idx)}
                onClick={() => run(r)}
                className="cmdk-item">
                <Icon className="cmdk-icon" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="cmdk-label">{r.label}</span>
                  <span className="cmdk-sub">{r.sub}</span>
                </span>
                <span className="cmdk-kind">{r.kind}</span>
              </button>
            );
          })}
        </div>
        <div className="cmdk-foot">
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
