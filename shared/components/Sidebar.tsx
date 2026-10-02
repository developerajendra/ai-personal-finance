'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Search, LogOut, Mail, X, Tag as TagIcon } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/shared/utils/cn';
import { PortfolioCategory } from '@/shared/types';
import { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';
import { useMoney, pct } from '@/shared/hooks/useMoney';
import { buildCashEvents } from '@/shared/utils/upcoming';
import { NAV, NAV_GROUPS, NAV_BOTTOM, type NavItem } from '@/shared/components/navigation';
import { Avatar, ShareBar, StackBar } from '@/shared/components/ui';

/** The Ledger mark: rounded tile with an axis and a rising accent line. */
export function LedgerLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="flex-none">
      <rect width="32" height="32" rx="8" fill="var(--logo-bg)" />
      <path d="M9 7.5V23.5H25" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 19L16.5 15.5L19 17.5L23.5 11.5" fill="none" stroke="var(--color-accent-300)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23.5" cy="11.5" r="1.9" fill="#fff" />
    </svg>
  );
}

export function Sidebar({ onOpenSearch }: { onOpenSearch?: () => void } = {}) {
  const pathname = usePathname() || '';
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState<boolean | null>(null);
  const [flyout, setFlyout] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<{
    isConnected: boolean;
  } | null>(null);
  const [portfolioCategories, setPortfolioCategories] = useState<
    PortfolioCategory[]
  >([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const flyTimer = useRef<ReturnType<typeof setTimeout>>();

  const totals = usePortfolioTotals();
  const { C } = useMoney();
  const overdueCount = useMemo(
    () => buildCashEvents({ loans: totals.loans, investments: totals.investments, bankBalances: totals.bankBalances }, 3).overdue.length,
    [totals.loans, totals.investments, totals.bankBalances],
  );

  // Fetch portfolio categories
  const fetchPortfolioCategories = async () => {
    try {
      const response = await fetch('/api/portfolio/categories');
      if (response.ok) {
        const categories = await response.json();
        setPortfolioCategories(categories);
      }
    } catch (error) {
      console.error('Error fetching portfolio categories:', error);
    }
  };

  // Load categories on mount and listen for updates
  useEffect(() => {
    fetchPortfolioCategories();

    // Listen for category updates
    const handleCategoryUpdate = () => {
      fetchPortfolioCategories();
    };
    window.addEventListener('portfolioCategoriesUpdated', handleCategoryUpdate);

    return () => {
      window.removeEventListener(
        'portfolioCategoriesUpdated',
        handleCategoryUpdate,
      );
    };
  }, []);

  const handleDeleteCategory = async (
    categoryId: string,
    categoryName: string,
  ) => {
    if (
      !confirm(
        `Are you sure you want to delete the category "${categoryName}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/portfolio/categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh categories
        fetchPortfolioCategories();
        // Trigger event for other components
        window.dispatchEvent(new CustomEvent('portfolioCategoriesUpdated'));
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete category');
      }
    } catch (error: any) {
      console.error('Error deleting category:', error);
      alert(error.message || 'Error deleting category');
    }
  };

  // Check Gmail status
  useEffect(() => {
    const checkGmailStatus = async () => {
      try {
        const response = await fetch('/api/gmail/status');
        const data = await response.json();
        setGmailStatus({ isConnected: data.isConnected || data.hasTokens });
      } catch (error) {
        console.error('Error checking Gmail status:', error);
      }
    };
    checkGmailStatus();
    const interval = setInterval(checkGmailStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  const handleLogout = async () => {
    if (
      !confirm(
        'Are you sure you want to logout? You will need to login again to access your data.',
      )
    ) {
      return;
    }

    setIsLoggingOut(true);
    try {
      // Clear Gmail cookies / agent tokens (best-effort; do not block app sign-out)
      await fetch('/api/gmail/disconnect', { method: 'POST' }).catch(() => undefined);
      await signOut({ callbackUrl: '/auth/signin' });
    } catch (error) {
      console.error('Error logging out:', error);
      alert('Failed to logout. Please try again.');
      setIsLoggingOut(false);
    }
  };

  // Portfolio children: the design's "Rich list" — dot · name · compact value · share bar.
  // Receivables lives under Loans & receivables, so it is not repeated here.
  const classRows = totals.classes.filter((c) => c.key !== 'recv');
  const classHrefs = new Set([...totals.classes.map((c) => c.href), '/portfolio/mutual-funds']);
  const dynamicRows = [...portfolioCategories]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((cat) => !classHrefs.has(cat.href));

  const portfolioActive = NAV.portfolio.match(pathname);
  const showKids = portfolioOpen ?? portfolioActive;
  const isActiveHref = (href: string) =>
    pathname === href || (href === '/portfolio/stocks' && pathname === '/portfolio/mutual-funds');

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'You';

  const richList = (
    <div className="space-y-0.5">
      {classRows.map((c) => (
        <Link
          key={c.key}
          href={c.href}
          onClick={() => setFlyout(false)}
          aria-current={isActiveHref(c.href) ? 'page' : undefined}
          className={cn(
            'block rounded-[8px] px-2.5 py-2 transition-colors',
            isActiveHref(c.href) ? 'bg-nav-sel font-semibold' : 'hover:bg-nav-hover',
          )}>
          <span className="flex items-center gap-2.5 text-[14px]">
            <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: c.color }} />
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
            <span className="flex-none text-[12px] font-semibold tabular-nums">{C(c.value)}</span>
          </span>
          <span className="mt-1.5 flex items-center gap-2 pl-[18px]">
            <ShareBar value={c.share} color={c.color} height={2} className="flex-1" />
            <span className="w-10 flex-none text-right text-[11px] text-side-muted tabular-nums">{pct(c.share)}</span>
          </span>
        </Link>
      ))}
      {dynamicRows.map((cat) => {
        const deletable = cat.slug !== 'receivables'; // Don't allow deleting receivables
        return (
          <div key={cat.id} className={cn('group/item flex items-center rounded-[8px]', isActiveHref(cat.href) ? 'bg-nav-sel' : 'hover:bg-nav-hover')}>
            <Link href={cat.href} onClick={() => setFlyout(false)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-[14px]">
              <TagIcon className="h-3.5 w-3.5 flex-none text-side-muted" strokeWidth={1.75} />
              <span className="truncate">{cat.name}</span>
            </Link>
            {deletable && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteCategory(cat.id, cat.name);
                }}
                className="mr-1.5 rounded-md p-1 text-loss opacity-0 transition-opacity hover:bg-loss-bg group-hover/item:opacity-100"
                title="Delete category"
                aria-label={`Delete category ${cat.name}`}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const row = (item: NavItem, extra?: { badge?: number; trailing?: React.ReactNode; below?: React.ReactNode }) => {
    const on = item.match(pathname);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        aria-current={on ? 'page' : undefined}
        title={isCollapsed ? item.label : undefined}
        className={cn(
          'relative flex min-h-[38px] items-center gap-3 rounded-[10px] px-2.5 text-[15px] transition-colors',
          isCollapsed && 'justify-center px-0',
          on ? 'bg-nav-sel font-semibold text-nav-sel-fg' : 'hover:bg-nav-hover',
        )}>
        <Icon className="h-[19px] w-[19px] flex-none" strokeWidth={1.75} />
        {!isCollapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate">{item.label}</span>
            {extra?.below}
          </span>
        )}
        {!isCollapsed && extra?.trailing}
        {!!extra?.badge && (
          <span
            className={cn(
              'flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full bg-loss px-1 text-[11px] font-semibold text-white',
              isCollapsed && 'absolute right-2 top-1',
            )}>
            {extra.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      data-sidebar
      className={cn(
        'glass-side sticky top-0 z-30 hidden h-screen flex-none flex-col gap-4 overflow-y-auto px-2.5 pb-3.5 pt-[18px] text-side-fg transition-[width] duration-200 md:flex',
        isCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}>
      {/* Logo + collapse */}
      <div className={cn('flex items-center gap-2 px-1.5', isCollapsed ? 'flex-col' : 'justify-between')}>
        <Link href="/dashboard" aria-label="Ledger home" className="flex min-w-0 items-center gap-2.5">
          <LedgerLogo />
          {!isCollapsed && (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-heading text-[16px] font-bold">Ledger</span>
              <span className="truncate text-[12px] text-side-muted">Net worth {C(totals.netWorth)}</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-side-muted hover:bg-nav-hover hover:text-side-fg"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {isCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.75} />}
        </button>
      </div>

      {/* Search */}
      <button
        type="button"
        onClick={() => onOpenSearch?.()}
        className={cn(
          'flex h-9 items-center gap-2 rounded-[10px] bg-[var(--search-bg)] px-3 text-[14px] text-side-muted',
          isCollapsed && 'justify-center px-0',
        )}
        aria-label="Search (⌘K)">
        <Search className="h-4 w-4 flex-none" strokeWidth={1.9} />
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left">Search</span>
            <kbd className="text-[11px] font-sans">⌘K</kbd>
          </>
        )}
      </button>

      {/* Groups */}
      <nav className="flex flex-col gap-4" aria-label="Main">
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col gap-0.5">
            {!isCollapsed && g.label && <div className="px-2.5 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-side-muted">{g.label}</div>}
            {g.items.map((item) => {
              if (item.key === 'portfolio') {
                return (
                  <div
                    key={item.key}
                    className="relative"
                    onMouseEnter={() => {
                      if (!isCollapsed) return;
                      clearTimeout(flyTimer.current);
                      setFlyout(true);
                    }}
                    onMouseLeave={() => {
                      if (!isCollapsed) return;
                      flyTimer.current = setTimeout(() => setFlyout(false), 180);
                    }}>
                    {row(item, {
                      below: !showKids ? (
                        <StackBar
                          className="mt-1"
                          height={3}
                          gap={1}
                          segments={classRows.map((c) => ({ value: c.value, color: c.color }))}
                        />
                      ) : undefined,
                      trailing: (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={showKids ? 'Hide asset classes' : 'Show asset classes'}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPortfolioOpen(!showKids);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setPortfolioOpen(!showKids);
                            }
                          }}
                          className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-side-muted hover:bg-nav-hover">
                          {showKids ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </span>
                      ),
                    })}
                    {!isCollapsed && showKids && <div className="mx-1.5 mt-1 rounded-[12px] bg-nav-hover p-1.5">{richList}</div>}
                    {isCollapsed && flyout && (
                      <div className="dialog absolute left-full top-0 z-50 ml-2 w-[270px] p-2 text-ink">
                        <div className="flex items-baseline justify-between px-2.5 pb-2 pt-1">
                          <Link href="/portfolio" className="text-[15px] font-semibold">
                            Portfolio
                          </Link>
                          <span className="text-[12px] text-muted">{C(totals.assets)}</span>
                        </div>
                        {richList}
                      </div>
                    )}
                  </div>
                );
              }
              return <div key={item.key}>{row(item, { badge: item.key === 'upcoming' ? overdueCount : undefined })}</div>;
            })}
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Bottom section */}
      <div className="flex flex-col gap-0.5 border-t border-side-rule pt-3">
        {NAV_BOTTOM.map((item) => (
          <div key={item.key}>{row(item)}</div>
        ))}
      </div>

      {/* Profile row — opens the account menu (Gmail status + logout) */}
      <div className="relative border-t border-side-rule pt-3" ref={userMenuRef}>
        <button
          type="button"
          onClick={() => setShowUserMenu(!showUserMenu)}
          className={cn('flex w-full items-center gap-2.5 rounded-[10px] p-1.5 text-left hover:bg-nav-hover', isCollapsed && 'justify-center')}
          aria-expanded={showUserMenu}
          aria-label="Account menu">
          <span className="relative">
            <Avatar name={userName} size={32} />
            {gmailStatus?.isConnected && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-bg)] bg-gain" title="Gmail connected" />
            )}
          </span>
          {!isCollapsed && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[14px] font-semibold">{userName}</span>
              <span className="block truncate text-[12px] text-side-muted">{session?.user?.email || 'Signed in'}</span>
            </span>
          )}
        </button>

        {showUserMenu && (
          <div className={cn('dialog absolute bottom-full z-[100] mb-2 w-60 py-2', isCollapsed ? 'left-full ml-2' : 'left-0')}>
            <div className="flex items-center gap-3 border-b border-divider px-4 pb-3 pt-1">
              <Avatar name={userName} size={36} />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">{userName}</p>
                <p className={cn('mt-0.5 flex items-center gap-1.5 text-[12px]', gmailStatus?.isConnected ? 'text-gain' : 'text-muted')}>
                  <Mail className="h-3 w-3" />
                  {gmailStatus?.isConnected ? 'Gmail Connected' : 'Not Connected'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] font-medium text-loss hover:bg-tile disabled:cursor-not-allowed disabled:opacity-50">
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        )}
      </div>

    </aside>
  );
}
