'use client';

import Link from 'next/link';
import { Dot, Panel, PanelHeader, PanelLink } from '@/shared/components/ui';
import { useMoney, pct, fmtDate } from '@/shared/hooks/useMoney';
import type { AssetClass } from '@/shared/hooks/usePortfolioTotals';
import type { Investment, PPFAccount } from '@/shared/types';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';

/** Assets by class minus loans = net worth (Portfolio page). */
export function BalanceSheetPanel({ classes, assets, liabilities, netWorth }: { classes: AssetClass[]; assets: number; liabilities: number; netWorth: number }) {
  const { M } = useMoney();
  const sorted = [...classes].sort((a, b) => b.value - a.value);
  return (
    <Panel>
      <PanelHeader title="Balance sheet" subtitle="Published assets at current value, minus outstanding loan balances" />
      <ul>
        {sorted.map((c) => (
          <li key={c.key} className="flex items-center gap-3 border-b border-divider py-2.5">
            <Dot color={c.color} size={9} />
            <Link href={c.href} className="flex-1 text-[14.5px] hover:text-accent-700">
              {c.label}
            </Link>
            <span className="text-[14px] tabular-nums">{M(c.value)}</span>
            <span className="w-14 text-right text-[13px] tabular-nums text-muted">{pct(c.share)}</span>
          </li>
        ))}
        <li className="flex items-center gap-3 border-b border-divider py-2.5 font-semibold">
          <span className="w-[9px]" />
          <span className="flex-1 text-[14.5px]">Total assets</span>
          <span className="text-[14px] tabular-nums">{M(assets)}</span>
          <span className="w-14" />
        </li>
        <li className="flex items-center gap-3 border-b border-divider py-2.5">
          <Dot color="var(--c-loan)" size={9} />
          <Link href="/portfolio/loans" className="flex-1 text-[14.5px] hover:text-accent-700">
            Loans outstanding (liability)
          </Link>
          <span className="text-[14px] tabular-nums text-loss">{M(-liabilities)}</span>
          <span className="w-14" />
        </li>
      </ul>
      <div className="flex items-center justify-between pt-4">
        <span className="text-[16px] font-semibold">Net worth</span>
        <span className="text-[19px] font-bold tabular-nums">{M(netWorth)}</span>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">
        Shares are of total assets. Drafts, closed records and paid receivables are excluded; receivables include agreed interest; property values are owner estimates.
      </p>
    </Panel>
  );
}

/** Retirement balances (EPF passbooks + NPS and other retirement records), moved here from the dashboard. */
export function RetirementPanel({ ppfAccounts, records, total }: { ppfAccounts: PPFAccount[]; records: Investment[]; total: number }) {
  const { M } = useMoney();
  const imported = ppfAccounts.map((p) => p.lastUpdated ?? p.extractedAt).filter(Boolean).sort()[0];
  return (
    <Panel>
      <PanelHeader title="Retirement" subtitle="EPF and NPS · withdrawal subject to eligibility (age, job change or specific purposes)" action={<PanelLink href="/portfolio/provident-fund">Details</PanelLink>} />
      <div className="text-[24px] font-bold tabular-nums">{M(total)}</div>
      <ul className="mt-3">
        {ppfAccounts.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 border-b border-divider py-2 text-[14px] last:border-0">
            <span className="min-w-0 truncate">EPF · {p.establishmentName || p.memberName || 'account'}</span>
            <span className="tabular-nums">{M(p.grandTotal || 0)}</span>
          </li>
        ))}
        {records.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 border-b border-divider py-2 text-[14px] last:border-0">
            <span className="min-w-0 truncate">
              {i.type === 'nps' ? 'NPS' : 'Retirement'} · {i.name}
            </span>
            <span className="tabular-nums">{M(getCurrentInvestmentValue(i))}</span>
          </li>
        ))}
      </ul>
      {imported && <p className="mt-2 text-[12.5px] text-muted">EPF passbook imported {fmtDate(imported)} — the passbook&apos;s own balance date isn&apos;t stored.</p>}
    </Panel>
  );
}
