'use client';

import { Panel, PanelHeader, ShareBar } from '@/shared/components/ui';
import { useMoney, pct } from '@/shared/hooks/useMoney';

/** "By bank / by type" style breakdown: name · value · share bar, sorted by value. */
export function BreakdownPanel({ title, items, color = 'var(--color-accent)' }: { title: string; items: { name: string; value: number }[]; color?: string }) {
  const { M } = useMoney();
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const sorted = [...items].sort((a, b) => b.value - a.value);
  return (
    <Panel>
      <PanelHeader title={title} />
      {sorted.length === 0 ? (
        <p className="text-[14px] text-muted">Nothing to break down yet.</p>
      ) : (
        <ul className="space-y-3.5">
          {sorted.map((i) => (
            <li key={i.name}>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="min-w-0 truncate">{i.name}</span>
                <span className="flex-none tabular-nums">{M(i.value)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <ShareBar value={(i.value / total) * 100} color={color} className="flex-1" />
                <span className="w-12 text-right text-[12px] tabular-nums text-muted">{pct((i.value / total) * 100)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
