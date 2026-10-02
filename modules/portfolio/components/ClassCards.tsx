'use client';

import Link from 'next/link';
import { IconTile, ShareBar } from '@/shared/components/ui';
import { useMoney, pct } from '@/shared/hooks/useMoney';
import type { AssetClass } from '@/shared/hooks/usePortfolioTotals';

/** One horizontal row of asset-class cards: tile icon, name, value, count, share of assets, share bar. */
export function ClassCards({ classes }: { classes: AssetClass[] }) {
  const { M } = useMoney();
  return (
    <div className="-mx-1 grid auto-cols-[minmax(176px,1fr)] grid-flow-col gap-3 overflow-x-auto px-1 pb-2 pt-1 scrollbar-none">
      {classes.map((c) => (
        <Link key={c.key} href={c.href} className="panel panel-lift flex flex-col px-4 py-4">
          <span className="flex items-center gap-2.5">
            <IconTile icon={c.icon} color={c.color === 'var(--c-recv)' || c.color === 'var(--c-prop)' ? undefined : c.color} />
            <span className="text-[14px] font-semibold leading-tight">{c.label}</span>
          </span>
          <span className="mt-3 text-[19px] font-bold tracking-[-0.01em] tabular-nums">{M(c.value)}</span>
          <span className="mt-2 text-[13px] text-muted">{c.note}</span>
          <span className="mt-1 text-[13px] text-muted">{pct(c.share)} of assets</span>
          <ShareBar className="mt-2.5" value={c.share} color={c.color} />
        </Link>
      ))}
    </div>
  );
}
