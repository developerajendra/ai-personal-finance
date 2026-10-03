'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftOpen } from 'lucide-react';
import { Sidebar, LedgerLogo } from '@/shared/components/Sidebar';
import { MobileTabBar } from '@/shared/components/MobileTabBar';
import { CommandPalette } from '@/shared/components/CommandPalette';
import { cn } from '@/shared/utils/cn';

const BARE_PATHS = ['/auth'];

/**
 * Persistent app frame from the design: sticky glass sidebar (desktop), floating tab bar (mobile)
 * and the ⌘K palette. Rendered once in the root providers so it survives page navigation —
 * the sidebar keeps its state and isn't re-mounted (or re-fetched) on every route change.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const bare = BARE_PATHS.some((p) => pathname.startsWith(p));

  // Whether the whole sidebar is hidden, remembered across visits
  useEffect(() => {
    try {
      setNavHidden(localStorage.getItem('ledger-nav-hidden') === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggleNav = useCallback(
    () =>
      setNavHidden((h) => {
      try {
        localStorage.setItem('ledger-nav-hidden', h ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !h;
      }),
    [],
  );

  // ⌘K / Ctrl+K opens search from anywhere
  useEffect(() => {
    if (bare) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        // ⌘\ / Ctrl+\ shows or hides the sidebar
        e.preventDefault();
        toggleNav();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bare, toggleNav]);

  if (bare) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <Sidebar onOpenSearch={() => setPaletteOpen(true)} hidden={navHidden} onToggle={toggleNav} />
      <main className={cn('relative min-w-0 flex-1 transition-[padding] duration-300', navHidden && 'md:pl-12')}>
        {/* Shown while the sidebar is hidden: brings it back */}
        <button
          type="button"
          onClick={toggleNav}
          aria-label="Show sidebar"
          title="Show sidebar (⌘\)"
          className={cn(
            'glass-side fixed left-4 top-4 z-40 hidden h-10 w-10 items-center justify-center rounded-full text-side-fg shadow-md transition-all duration-300 md:flex',
            navHidden ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-3 opacity-0',
          )}>
          <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
        {/* Mobile header: logo only (navigation lives in the floating tab bar) */}
        <div className="flex items-center px-4 pt-4 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="Ledger home">
            <LedgerLogo size={28} />
            <span className="font-heading text-[19px] font-bold">Ledger</span>
          </Link>
        </div>
        {children}
      </main>
      <MobileTabBar onOpenSearch={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

/**
 * Page content column (max 1440px, fluid side padding). Pages wrap their content in this;
 * the frame around it comes from AppFrame.
 */
export function AppShell({ children, wide, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        'page-enter mx-auto w-full px-4 pb-32 pt-6 sm:px-[clamp(16px,3.6vw,52px)] md:pb-16 md:pt-8',
        wide ? 'max-w-none' : 'max-w-[1440px]',
        className,
      )}>
      {children}
    </div>
  );
}
