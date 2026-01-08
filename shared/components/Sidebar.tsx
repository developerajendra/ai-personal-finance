'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Database,
  Upload,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  PieChart,
  Home,
  CreditCard,
  Wallet,
  BarChart3,
  Tag,
  Sparkles,
  User,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { GmailConnectionTooltip } from '@/modules/admin-panel/components/GmailConnectionTooltip';

// Navigation structure - clean and intuitive
const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    defaultHref: '/dashboard',
    submenu: [
      { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Analytics', href: '/dashboard/chart', icon: BarChart3 },
    ],
  },
  {
    name: 'Portfolio',
    href: '/portfolio',
    icon: Briefcase,
    defaultHref: '/portfolio',
    submenu: [
      { name: 'Overview', href: '/portfolio', icon: Briefcase },
      { name: 'Stocks', href: '/portfolio/stocks', icon: TrendingUp },
      { name: 'Mutual Funds', href: '/portfolio/mutual-funds', icon: PieChart },
      { name: 'Loans', href: '/portfolio/loans', icon: CreditCard },
      { name: 'Properties', href: '/portfolio/properties', icon: Home },
      { name: 'Bank Balances', href: '/portfolio/bank-balances', icon: Wallet },
    ],
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: Database,
    defaultHref: '/transactions',
    submenu: [
      { name: 'All Transactions', href: '/transactions', icon: Database },
      { name: 'Categories', href: '/transactions/categories', icon: Tag },
    ],
  },
  {
    name: 'Data',
    href: '/data',
    icon: Upload,
    defaultHref: '/data/upload',
    submenu: [
      { name: 'Upload Files', href: '/data/upload', icon: Upload },
      { name: 'AI Analysis', href: '/data/analysis', icon: Sparkles },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showGmailTooltip, setShowGmailTooltip] = useState(false);
  const [gmailTooltipOpen, setGmailTooltipOpen] = useState(false);
  const gmailTooltipRef = useRef<HTMLDivElement>(null);

  // Determine which menu should be open based on current path
  useEffect(() => {
    const activeMenu = navigation.find((menu) => {
      if (pathname === menu.href || pathname === menu.defaultHref) return true;
      return menu.submenu?.some((item) => pathname === item.href);
    });

    if (activeMenu) {
      setOpenMenus(new Set([activeMenu.name]));
    }
  }, [pathname]);

  const toggleMenu = (menuName: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuName)) {
        next.delete(menuName);
      } else {
        next.add(menuName);
      }
      return next;
    });
  };

  const isMenuOpen = (menuName: string) => openMenus.has(menuName);

  const isActive = (href: string) => pathname === href;

  const isMenuActive = (menu: typeof navigation[0]) => {
    if (pathname === menu.href || pathname === menu.defaultHref) return true;
    return menu.submenu?.some((item) => pathname === item.href) || false;
  };

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking on the user icon or inside the tooltip
      if (
        gmailTooltipRef.current &&
        !gmailTooltipRef.current.contains(target) &&
        !target.closest('.user-icon-container')
      ) {
        setGmailTooltipOpen(false);
        setShowGmailTooltip(false);
      }
    };

    if (gmailTooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [gmailTooltipOpen]);

  const handleMenuClick = (menu: typeof navigation[0], e: React.MouseEvent) => {
    if (isCollapsed) {
      e.preventDefault();
      toggleMenu(menu.name);
      return;
    }
    // Navigate to default href if clicking main menu item
    if (pathname !== menu.defaultHref && !isMenuActive(menu)) {
      e.preventDefault();
      window.location.href = menu.defaultHref;
    }
  };

  return (
    <div
      className={cn(
        'bg-gray-900 text-white flex flex-col transition-all duration-300 ease-in-out relative',
        isCollapsed ? 'w-20' : 'w-64'
      )}>
      {/* User Profile Section */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3 flex-1 relative">
                <div 
                  className="user-icon-container w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                  onMouseEnter={() => !gmailTooltipOpen && setShowGmailTooltip(true)}
                  onMouseLeave={() => !gmailTooltipOpen && setShowGmailTooltip(false)}
                  onClick={() => setGmailTooltipOpen(!gmailTooltipOpen)}
                >
                  <User className="w-5 h-5" />
                </div>
                {(showGmailTooltip || gmailTooltipOpen) && (
                  <div ref={gmailTooltipRef} className="absolute left-0 top-full mt-2 z-50">
                    <GmailConnectionTooltip onClose={() => setGmailTooltipOpen(false)} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Finance Manager
                  </p>
                  <p className="text-sm font-semibold truncate">User</p>
                </div>
              </div>
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                aria-label="Collapse sidebar">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center w-full relative">
              <div 
                className="user-icon-container w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                onMouseEnter={() => !gmailTooltipOpen && setShowGmailTooltip(true)}
                onMouseLeave={() => !gmailTooltipOpen && setShowGmailTooltip(false)}
                onClick={() => setGmailTooltipOpen(!gmailTooltipOpen)}
              >
                <User className="w-5 h-5" />
              </div>
              {(showGmailTooltip || gmailTooltipOpen) && (
                <div ref={gmailTooltipRef} className="absolute left-full ml-2 top-0 z-50">
                  <GmailConnectionTooltip onClose={() => setGmailTooltipOpen(false)} />
                </div>
              )}
              <button
                onClick={() => setIsCollapsed(false)}
                className="absolute -right-3 top-6 p-1.5 rounded-full bg-gray-800 border-2 border-gray-700 hover:bg-gray-700 transition-colors z-10"
                aria-label="Expand sidebar">
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((menu) => {
          const menuActive = isMenuActive(menu);
          const menuOpen = isMenuOpen(menu.name);

          if (isCollapsed) {
            return (
              <div key={menu.name} className="relative">
                <Link
                  href={menu.defaultHref}
                  onClick={(e) => handleMenuClick(menu, e)}
                  onMouseEnter={() => setHoveredItem(menu.name)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={cn(
                    'w-full flex items-center justify-center p-3 rounded-xl transition-all duration-200 mb-1',
                    menuActive
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}>
                  <menu.icon className="w-5 h-5" />
                </Link>
                {hoveredItem === menu.name && menuOpen && (
                  <div className="absolute left-full ml-2 top-0 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 min-w-[200px] z-50">
                    {menu.submenu?.map((item) => {
                      const itemActive = isActive(item.href);
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setHoveredItem(null)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2 text-sm',
                            itemActive
                              ? 'text-purple-300 bg-purple-600/20'
                              : 'text-gray-300 hover:bg-gray-700'
                          )}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={menu.name} className="space-y-1">
              <div className="flex items-center gap-1">
                <Link
                  href={menu.defaultHref}
                  onClick={(e) => handleMenuClick(menu, e)}
                  className={cn(
                    'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                    menuActive
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}>
                  <menu.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{menu.name}</span>
                </Link>
                {menu.submenu && menu.submenu.length > 0 && (
                  <button
                    onClick={() => toggleMenu(menu.name)}
                    className={cn(
                      'p-2 rounded-lg transition-all duration-200',
                      menuActive
                        ? 'text-white hover:bg-purple-700'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    )}>
                    {menuOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {menuOpen && menu.submenu && (
                <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-gray-700 pl-3">
                  {menu.submenu.map((item) => {
                    const itemActive = isActive(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm relative group',
                          itemActive
                            ? 'bg-purple-600/20 text-purple-300 font-medium'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        )}>
                        <div
                          className={cn(
                            'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full transition-all',
                            itemActive
                              ? 'bg-purple-400 -ml-4 w-1.5 h-1.5'
                              : 'bg-gray-600 -ml-4 group-hover:bg-gray-500'
                          )}
                        />
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* AI Assistant Button */}
      <div className="p-4 border-t border-gray-800">
        {!isCollapsed ? (
          <Link
            href="/chatbot"
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
              pathname === '/chatbot'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}>
            <MessageSquare className="w-5 h-5" />
            <span className="font-medium">AI Assistant</span>
          </Link>
        ) : (
          <div className="relative">
            <Link
              href="/chatbot"
              onMouseEnter={() => setHoveredItem('assistant')}
              onMouseLeave={() => setHoveredItem(null)}
              className={cn(
                'flex items-center justify-center p-3 rounded-xl transition-all duration-200',
                pathname === '/chatbot'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}>
              <MessageSquare className="w-5 h-5" />
            </Link>
            {hoveredItem === 'assistant' && (
              <div className="absolute left-full ml-2 bottom-4 bg-gray-800 rounded-lg shadow-xl border border-gray-700 px-3 py-2 text-sm whitespace-nowrap z-50">
                AI Assistant
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
