'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useMemo } from 'react';
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
  LogOut,
  Mail,
  LucideIcon,
  X,
  Archive,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { PortfolioCategory } from '@/core/types';

// Icon mapping for dynamic categories
const iconMap: Record<string, LucideIcon> = {
  TrendingUp,
  PieChart,
  Home,
  CreditCard,
  Wallet,
  Tag,
  Briefcase,
  BarChart3,
  LayoutDashboard,
  Database,
  Upload,
  Sparkles,
  Mail,
  Archive,
  // Add more icons as needed
};

// Get icon component from name
function getIcon(iconName?: string): LucideIcon {
  if (!iconName) return Tag; // Default icon
  return iconMap[iconName] || Tag;
}

// Base navigation structure - clean and intuitive
const baseNavigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    defaultHref: '/dashboard',
    submenu: [
      { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Analytics', href: '/dashboard/chart', icon: BarChart3 },
      { name: 'Archive', href: '/dashboard/archive', icon: Archive },
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
      { name: 'Provident Fund', href: '/portfolio/provident-fund', icon: Wallet },
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<{ isConnected: boolean } | null>(null);
  const [portfolioCategories, setPortfolioCategories] = useState<PortfolioCategory[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
      window.removeEventListener('portfolioCategoriesUpdated', handleCategoryUpdate);
    };
  }, []);

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete the category "${categoryName}"? This action cannot be undone.`)) {
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

  // Build navigation with dynamic categories - memoized to update when categories change
  const navigation = useMemo(() => {
    return baseNavigation.map((menu) => {
      if (menu.name === 'Portfolio') {
        // Sort dynamic categories alphabetically by name
        const sortedCategories = [...portfolioCategories].sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        
        // Add dynamic categories to Portfolio submenu with full category data
        const dynamicSubmenu = sortedCategories.map((cat) => ({
          name: cat.name,
          href: cat.href,
          icon: getIcon(cat.icon),
          categoryId: cat.id, // Store ID for deletion
          isDynamic: true, // Flag to identify dynamic categories
          slug: cat.slug, // Store slug to check if deletable
        }));
        
        return {
          ...menu,
          submenu: [...(menu.submenu || []), ...dynamicSubmenu],
        };
      }
      return menu;
    });
  }, [portfolioCategories]);

  // Determine which menu should be open based on current path
  useEffect(() => {
    const activeMenu = navigation.find((menu) => {
      if (pathname === menu.href || pathname === menu.defaultHref) return true;
      return menu.submenu?.some((item) => pathname === item.href);
    });

    if (activeMenu) {
      setOpenMenus(new Set([activeMenu.name]));
    }
  }, [pathname, portfolioCategories]); // Include portfolioCategories to update when categories change

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
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout? You will need to login again to access your data.')) {
      return;
    }

    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/gmail/disconnect', { method: 'POST' });
      if (response.ok) {
        // Reload the page to show login screen
        window.location.reload();
      } else {
        throw new Error('Failed to logout');
      }
    } catch (error) {
      console.error('Error logging out:', error);
      alert('Failed to logout. Please try again.');
      setIsLoggingOut(false);
    }
  };

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
      <div className="p-4 border-b border-gray-800 relative">
        <div className="flex items-center justify-between">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3 flex-1" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 flex-1 hover:bg-gray-800 rounded-lg p-2 -m-2 transition-colors group">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                      <User className="w-5 h-5" />
                    </div>
                    {gmailStatus?.isConnected && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Finance Manager
                    </p>
                    <p className="text-sm font-semibold truncate">User</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute left-0 top-full mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 z-[100]">
                    <div className="px-4 py-3 border-b border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                            <User className="w-5 h-5" />
                          </div>
                          {gmailStatus?.isConnected && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">User</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Mail className={`w-3 h-3 ${gmailStatus?.isConnected ? 'text-green-400' : 'text-gray-500'}`} />
                            <p className={`text-xs ${gmailStatus?.isConnected ? 'text-green-400' : 'text-gray-500'}`}>
                              {gmailStatus?.isConnected ? 'Gmail Connected' : 'Not Connected'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-400 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {isLoggingOut ? 'Logging out...' : 'Logout'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors ml-2"
                aria-label="Collapse sidebar">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center w-full relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold hover:ring-2 hover:ring-purple-400 transition-all">
                  <User className="w-5 h-5" />
                </div>
                {gmailStatus?.isConnected && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900"></div>
                )}
              </button>
              
              {/* User Dropdown Menu (Collapsed) */}
              {showUserMenu && (
                <div className="absolute left-full ml-2 top-0 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 z-[100]">
                  <div className="px-4 py-3 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                          <User className="w-5 h-5" />
                        </div>
                        {gmailStatus?.isConnected && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">User</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className={`w-3 h-3 ${gmailStatus?.isConnected ? 'text-green-400' : 'text-gray-500'}`} />
                          <p className={`text-xs ${gmailStatus?.isConnected ? 'text-green-400' : 'text-gray-500'}`}>
                            {gmailStatus?.isConnected ? 'Gmail Connected' : 'Not Connected'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-400 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {isLoggingOut ? 'Logging out...' : 'Logout'}
                    </span>
                  </button>
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
                    {menu.submenu?.map((item: any) => {
                      const itemActive = isActive(item.href);
                    const isDynamic = item.isDynamic;
                    const isDeletable = isDynamic && item.slug !== 'receivables'; // Don't allow deleting receivables
                    return (
                      <div
                        key={item.name}
                        className="flex items-center gap-2 group/item">
                        <Link
                          href={item.href}
                          onClick={() => setHoveredItem(null)}
                          className={cn(
                            'flex-1 flex items-center gap-3 px-4 py-2 text-sm',
                            itemActive
                              ? 'text-purple-300 bg-purple-600/20'
                              : 'text-gray-300 hover:bg-gray-700'
                          )}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </Link>
                        {isDeletable && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleDeleteCategory(item.categoryId, item.name);
                              setHoveredItem(null);
                            }}
                            className="opacity-0 group-hover/item:opacity-100 p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-all mr-2"
                            title="Delete category">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
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
                  {menu.submenu.map((item: any) => {
                    const itemActive = isActive(item.href);
                      const isDynamic = item.isDynamic;
                      const isDeletable = isDynamic && item.slug !== 'receivables'; // Don't allow deleting receivables
                      return (
                        <div
                          key={item.name}
                          className={cn(
                            'flex items-center gap-2 group/item',
                            itemActive
                              ? 'bg-purple-600/20 rounded-lg'
                              : 'hover:bg-gray-800 rounded-lg'
                          )}>
                          <Link
                            href={item.href}
                            className={cn(
                              'flex-1 flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm relative',
                              itemActive
                                ? 'text-purple-300 font-medium'
                                : 'text-gray-400 hover:text-white'
                            )}>
                            <div
                              className={cn(
                                'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full transition-all',
                                itemActive
                                  ? 'bg-purple-400 -ml-4 w-1.5 h-1.5'
                                  : 'bg-gray-600 -ml-4 group-hover/item:bg-gray-500'
                              )}
                            />
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            <span>{item.name}</span>
                          </Link>
                          {isDeletable && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeleteCategory(item.categoryId, item.name);
                              }}
                              className="opacity-0 group-hover/item:opacity-100 p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-all mr-2"
                              title="Delete category">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
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
