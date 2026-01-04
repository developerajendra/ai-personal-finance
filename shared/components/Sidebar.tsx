'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Settings,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Upload,
  Database,
  Briefcase,
  Tag,
  BarChart3,
  User,
  TrendingUp,
  PieChart,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const dashboardSubmenu = [
  { name: 'Quick Chart', href: '/dashboard/chart', icon: BarChart3 },
];

const adminSubmenu = [
  { name: 'Upload & AI Analysis', href: '/admin/upload', icon: Upload },
  { name: 'Transactions', href: '/admin/transactions', icon: Database },
  {
    name: 'Portfolio (AI Categorized)',
    href: '/admin/portfolio',
    icon: Briefcase,
    submenu: [
      { name: 'Overview', href: '/admin/portfolio', icon: Briefcase },
      { name: 'Stocks', href: '/admin/portfolio/stocks', icon: TrendingUp },
      { name: 'Mutual Funds', href: '/admin/portfolio/mutual-funds', icon: PieChart },
    ],
  },
  { name: 'Dynamic Categories', href: '/admin/categories', icon: Tag },
];

export function Sidebar() {
  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith('/admin');
  const isDashboardPath = pathname?.startsWith('/dashboard');
  const [isAdminOpen, setIsAdminOpen] = useState(isAdminPath);
  const [isDashboardOpen, setIsDashboardOpen] = useState(isDashboardPath);
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(pathname?.startsWith('/admin/portfolio'));
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Auto-expand based on current path
  useEffect(() => {
    if (isDashboardPath) {
      setIsDashboardOpen(true);
    }
    if (isAdminPath) {
      setIsAdminOpen(true);
    }
    if (pathname?.startsWith('/admin/portfolio')) {
      setIsPortfolioOpen(true);
    }
  }, [isDashboardPath, isAdminPath, pathname]);

  const handleDashboardClick = () => {
    setIsDashboardOpen(!isDashboardOpen);
  };

  const handleAdminClick = () => {
    setIsAdminOpen(!isAdminOpen);
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
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                  <User className="w-5 h-5" />
                </div>
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
            <div className="flex items-center justify-center w-full">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                <User className="w-5 h-5" />
              </div>
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
        {/* Dashboard Section */}
        <div className="space-y-1">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-1">
                <Link
                  href="/dashboard"
                  className={cn(
                    'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                    isDashboardPath
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}>
                  <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">Dashboard</span>
                </Link>
                <button
                  onClick={handleDashboardClick}
                  className={cn(
                    'p-2 rounded-lg transition-all duration-200',
                    isDashboardPath
                      ? 'text-white hover:bg-purple-700'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}>
                  {isDashboardOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </div>

              {isDashboardOpen && (
                <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-gray-700 pl-3">
                  <Link
                    href="/dashboard"
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm relative',
                      pathname === '/dashboard'
                        ? 'bg-purple-600/20 text-purple-300 font-medium'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    )}>
                    <div
                      className={cn(
                        'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full',
                        pathname === '/dashboard'
                          ? 'bg-purple-400 -ml-4'
                          : 'bg-gray-600 -ml-4'
                      )}
                    />
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Overview</span>
                  </Link>
                  {dashboardSubmenu.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm relative',
                          isActive
                            ? 'bg-purple-600/20 text-purple-300 font-medium'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        )}>
                        <div
                          className={cn(
                            'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full',
                            isActive
                              ? 'bg-purple-400 -ml-4'
                              : 'bg-gray-600 -ml-4'
                          )}
                        />
                        <item.icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="relative">
              <Link
                href="/dashboard"
                onClick={(e) => {
                  e.preventDefault();
                  handleDashboardClick();
                }}
                onMouseEnter={() => setHoveredItem('dashboard')}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn(
                  'w-full flex items-center justify-center p-3 rounded-xl transition-all duration-200',
                  isDashboardPath
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}>
                <LayoutDashboard className="w-5 h-5" />
              </Link>
              {hoveredItem === 'dashboard' && isDashboardOpen && (
                <div className="absolute left-full ml-2 top-0 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 min-w-[180px] z-50">
                  <Link
                    href="/dashboard"
                    onClick={() => setHoveredItem(null)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2 text-sm',
                      pathname === '/dashboard'
                        ? 'text-purple-300 bg-purple-600/20'
                        : 'text-gray-300 hover:bg-gray-700'
                    )}>
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Overview</span>
                  </Link>
                  {dashboardSubmenu.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setHoveredItem(null)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2 text-sm',
                          isActive
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
          )}
        </div>

        {/* Admin Section */}
        <div className="space-y-1">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-1">
                <Link
                  href="/admin/portfolio"
                  className={cn(
                    'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                    isAdminPath
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}>
                  <Settings className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">Admin</span>
                </Link>
                <button
                  onClick={handleAdminClick}
                  className={cn(
                    'p-2 rounded-lg transition-all duration-200',
                    isAdminPath
                      ? 'text-white hover:bg-purple-700'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}>
                  {isAdminOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </div>

              {isAdminOpen && (
                <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-gray-700 pl-3">
                  {adminSubmenu.map((item) => {
                    const isActive = pathname === item.href || (item.submenu && item.submenu.some(sub => pathname === sub.href));
                    const hasSubmenu = item.submenu && item.submenu.length > 0;
                    const isPortfolioItem = item.name === 'Portfolio (AI Categorized)';
                    
                    return (
                      <div key={item.name}>
                        <div className="flex items-center gap-1">
                          <Link
                            href={item.href}
                            className={cn(
                              'flex-1 flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm relative',
                              isActive
                                ? 'bg-purple-600/20 text-purple-300 font-medium'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            )}>
                            <div
                              className={cn(
                                'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full',
                                isActive
                                  ? 'bg-purple-400 -ml-4'
                                  : 'bg-gray-600 -ml-4'
                              )}
                            />
                            <item.icon className="w-4 h-4" />
                            <span>{item.name}</span>
                          </Link>
                          {hasSubmenu && (
                            <button
                              onClick={() => {
                                if (isPortfolioItem) {
                                  setIsPortfolioOpen(!isPortfolioOpen);
                                }
                              }}
                              className={cn(
                                'p-1 rounded transition-colors',
                                isActive
                                  ? 'text-purple-300 hover:bg-purple-600/30'
                                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                              )}>
                              {isPortfolioOpen ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                        {hasSubmenu && isPortfolioOpen && (
                          <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-gray-700 pl-3">
                            {item.submenu?.map((subItem) => {
                              const isSubActive = pathname === subItem.href;
                              return (
                                <Link
                                  key={subItem.name}
                                  href={subItem.href}
                                  className={cn(
                                    'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-xs relative',
                                    isSubActive
                                      ? 'bg-purple-600/30 text-purple-200 font-medium'
                                      : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                                  )}>
                                  <div
                                    className={cn(
                                      'absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0.5 rounded-full',
                                      isSubActive
                                        ? 'bg-purple-400 -ml-3.5'
                                        : 'bg-gray-600 -ml-3.5'
                                    )}
                                  />
                                  <subItem.icon className="w-3 h-3" />
                                  <span>{subItem.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="relative">
              <Link
                href="/admin/portfolio"
                onClick={(e) => {
                  e.preventDefault();
                  handleAdminClick();
                }}
                onMouseEnter={() => setHoveredItem('admin')}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn(
                  'w-full flex items-center justify-center p-3 rounded-xl transition-all duration-200',
                  isAdminPath
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}>
                <Settings className="w-5 h-5" />
              </Link>
              {hoveredItem === 'admin' && isAdminOpen && (
                <div className="absolute left-full ml-2 top-0 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 min-w-[200px] z-50">
                  {adminSubmenu.map((item) => {
                    const isActive = pathname === item.href || (item.submenu && item.submenu.some(sub => pathname === sub.href));
                    const hasSubmenu = item.submenu && item.submenu.length > 0;
                    const isPortfolioItem = item.name === 'Portfolio (AI Categorized)';
                    
                    return (
                      <div key={item.name}>
                        <Link
                          href={item.href}
                          onClick={() => setHoveredItem(null)}
                          onMouseEnter={() => {
                            if (isPortfolioItem) {
                              setIsPortfolioOpen(true);
                            }
                          }}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2 text-sm',
                            isActive
                              ? 'text-purple-300 bg-purple-600/20'
                              : 'text-gray-300 hover:bg-gray-700'
                          )}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.name}</span>
                          {hasSubmenu && (
                            <ChevronRight className="w-3 h-3 ml-auto" />
                          )}
                        </Link>
                        {hasSubmenu && isPortfolioOpen && (
                          <div className="ml-4 border-l border-gray-700 pl-2">
                            {item.submenu?.map((subItem) => {
                              const isSubActive = pathname === subItem.href;
                              return (
                                <Link
                                  key={subItem.name}
                                  href={subItem.href}
                                  onClick={() => setHoveredItem(null)}
                                  className={cn(
                                    'flex items-center gap-2 px-3 py-1.5 text-xs',
                                    isSubActive
                                      ? 'text-purple-200 bg-purple-600/30'
                                      : 'text-gray-400 hover:bg-gray-700'
                                  )}>
                                  <subItem.icon className="w-3 h-3" />
                                  <span>{subItem.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* AI Assistant Button */}
      <div className="p-4 border-t border-gray-800">
        {!isCollapsed ? (
          <Link
            href="/dashboard/chart"
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
              pathname === '/dashboard/chart'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}>
            <MessageSquare className="w-5 h-5" />
            <span className="font-medium">AI Assistant</span>
          </Link>
        ) : (
          <div className="relative">
            <Link
              href="/dashboard/chart"
              onMouseEnter={() => setHoveredItem('assistant')}
              onMouseLeave={() => setHoveredItem(null)}
              className={cn(
                'flex items-center justify-center p-3 rounded-xl transition-all duration-200',
                pathname === '/dashboard/chart'
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
