'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { NAV, SEARCH_EXTRA } from '@/shared/components/navigation';

/** ⌘K quick navigation across every screen. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo(
    () => [
      ...Object.values(NAV).map((n) => ({ label: n.label, href: n.href, group: 'Go to' })),
      ...SEARCH_EXTRA,
    ],
    [],
  );
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? all.filter((r) => `${r.label} ${r.group}`.toLowerCase().includes(t)) : all;
  }, [q, all]);

  useEffect(() => {
    if (open) {
      setQ('');
      setI(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <button type="button" aria-label="Close search" className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="dialog relative w-full max-w-[560px] overflow-hidden">
        <div className="flex items-center gap-3 border-b border-divider px-4">
          <Search className="h-[18px] w-[18px] text-muted" />
          <input
            ref={inputRef}
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
              } else if (e.key === 'Enter' && results[i]) {
                go(results[i]!.href);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Search screens, accounts and tools"
            className="h-14 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-neutral-500"
          />
          <kbd className="tag">esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <li className="px-3 py-6 text-center text-[14px] text-muted">No matches for “{q}”</li>}
          {results.map((r, idx) => (
            <li key={r.href + r.label} role="option" aria-selected={idx === i}>
              <button
                type="button"
                onMouseEnter={() => setI(idx)}
                onClick={() => go(r.href)}
                className={cn('flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left text-[14.5px]', idx === i && 'bg-accent-100')}>
                <span>
                  <span className="text-ink">{r.label}</span>
                  <span className="ml-2 text-[12.5px] text-muted">{r.group}</span>
                </span>
                {idx === i && <CornerDownLeft className="h-4 w-4 text-muted" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
