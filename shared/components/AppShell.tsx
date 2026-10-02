'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Sidebar, LedgerLogo } from '@/shared/components/Sidebar';
import { MobileTabBar } from '@/shared/components/MobileTabBar';
import { CommandPalette } from '@/shared/components/CommandPalette';
import { cn } from '@/shared/utils/cn';

/**
 * App frame from the design: sticky glass sidebar (desktop), floating tab bar (mobile),
 * and a centred content column (max 1440px, fluid side padding).
 */
export function AppShell({ children, wide, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K opens search from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <Sidebar onOpenSearch={() => setPaletteOpen(true)} />
      <main className="min-w-0 flex-1">
        {/* Mobile header: logo only (navigation lives in the floating tab bar) */}
        <div className="flex items-center px-4 pt-4 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="Ledger home">
            <LedgerLogo size={28} />
            <span className="font-heading text-[19px] font-bold">Ledger</span>
          </Link>
        </div>
        <div
          className={cn(
            'mx-auto w-full px-4 pb-32 pt-6 sm:px-[clamp(16px,3.6vw,52px)] md:pb-16 md:pt-8',
            wide ? 'max-w-none' : 'max-w-[1440px]',
            className,
          )}>
          {children}
        </div>
      </main>
      <MobileTabBar onOpenSearch={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
