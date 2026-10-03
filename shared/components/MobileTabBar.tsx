'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MoreHorizontal, Search, X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { MOBILE_MORE, MOBILE_TABS } from '@/shared/components/navigation';
import { AppearancePicker } from '@/shared/components/AppearancePicker';

/** Mobile (<768px): floating glass tab bar + "More" sheet with the remaining routes and the theme picker. */
export function MobileTabBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname() || '';
  const [more, setMore] = useState(false);
  // The tapped tab lights up immediately instead of waiting for the route to finish loading
  const [pending, setPending] = useState<string | null>(null);
  const current = pending ?? pathname;
  const moreActive = MOBILE_MORE.some((n) => n.match(current));

  useEffect(() => {
    setMore(false);
    setPending(null);
  }, [pathname]);

  return (
    <>
      <nav
        data-tabbar
        aria-label="Primary"
        className="glass-tabbar fixed bottom-3 left-3 right-3 z-40 flex items-stretch justify-around rounded-[26px] px-1 pt-2 md:hidden"
        style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}>
        {MOBILE_TABS.map(({ item, label }) => {
          const on = item.match(current) && !more;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={on ? 'page' : undefined}
              onClick={() => {
                setMore(false);
                if (!item.match(pathname)) setPending(item.href);
              }}
              className={cn('tab-btn flex min-w-0 flex-1 flex-col items-center gap-1 py-0.5 text-[11px]', on ? 'font-semibold text-accent-800' : 'text-ink')}>
              <span className={cn('tab-pill flex h-8 w-[52px] items-center justify-center rounded-full', on && 'bg-accent-100')}>
                <Icon className="h-[21px] w-[21px]" strokeWidth={on ? 2 : 1.75} />
              </span>
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore(!more)}
          aria-expanded={more}
          className={cn('tab-btn flex min-w-0 flex-1 flex-col items-center gap-1 py-0.5 text-[11px]', more || moreActive ? 'font-semibold text-accent-800' : 'text-ink')}>
          <span className={cn('tab-pill flex h-8 w-[52px] items-center justify-center rounded-full', (more || moreActive) && 'bg-accent-100')}>
            <MoreHorizontal className="h-[21px] w-[21px]" strokeWidth={1.75} />
          </span>
          More
        </button>
      </nav>

      {more && (
        <div className="fixed inset-0 z-[45] md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/25" onClick={() => setMore(false)} />
          <div className="dialog absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-b-none px-4 pb-28 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[19px]">More</h2>
              <button type="button" className="btn btn-secondary btn-icon" aria-label="Close" onClick={() => setMore(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setMore(false);
                onOpenSearch();
              }}
              className="mb-3 flex h-10 w-full items-center gap-2 rounded-[10px] bg-[var(--search-bg)] px-3 text-[15px] text-muted">
              <Search className="h-4 w-4" /> Search
            </button>
            <div className="grid grid-cols-2 gap-2">
              {MOBILE_MORE.map((n) => {
                const Icon = n.icon;
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    onClick={() => {
                      setMore(false);
                      if (!n.match(pathname)) setPending(n.href);
                    }}
                    className={cn('panel flex items-center gap-3 px-4 py-3.5 text-[15px] active:scale-[0.98]', n.match(current) && 'font-semibold text-accent-800')}>
                    <Icon className="h-5 w-5 text-accent-700" strokeWidth={1.75} />
                    {n.label}
                  </Link>
                );
              })}
            </div>
            <div className="mt-5">
              <AppearancePicker compact />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
