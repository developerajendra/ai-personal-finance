import {
  LayoutGrid,
  LineChart,
  Briefcase,
  HandCoins,
  Landmark,
  Wallet,
  CalendarDays,
  Repeat,
  PlugZap,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Routes that light this item up */
  match: (path: string) => boolean;
}

const starts = (...prefixes: string[]) => (p: string) => prefixes.some((x) => p === x || p.startsWith(x + '/'));

export const NAV: Record<string, NavItem> = {
  overview: { key: 'overview', label: 'Dashboard', href: '/dashboard', icon: LayoutGrid, match: (p) => p === '/dashboard' || p === '/dashboard/chart' },
  performance: { key: 'performance', label: 'Performance', href: '/performance', icon: LineChart, match: starts('/performance') },
  portfolio: {
    key: 'portfolio',
    label: 'Portfolio',
    href: '/portfolio',
    icon: Briefcase,
    // Receivables are an asset class (personal lending), so they live under Portfolio; loans are liabilities
    match: (p) => starts('/portfolio')(p) && !starts('/portfolio/loans')(p),
  },
  loans: { key: 'loans', label: 'Loans', href: '/portfolio/loans', icon: Landmark, match: starts('/portfolio/loans') },
  receivables: { key: 'receivables', label: 'Receivables', href: '/portfolio/receivables', icon: HandCoins, match: starts('/portfolio/receivables') },
  budget: { key: 'budget', label: 'Budget', href: '/budget', icon: Wallet, match: starts('/budget') },
  subscriptions: { key: 'subscriptions', label: 'Subscriptions', href: '/subscriptions', icon: Repeat, match: starts('/subscriptions', '/transactions/subscriptions') },
  upcoming: { key: 'upcoming', label: 'Upcoming', href: '/upcoming', icon: CalendarDays, match: starts('/upcoming') },
  imports: { key: 'imports', label: 'Imports & data', href: '/data/upload', icon: PlugZap, match: starts('/data', '/admin') },
  assistant: { key: 'assistant', label: 'Assistant', href: '/chatbot', icon: Sparkles, match: starts('/chatbot') },
  settings: { key: 'settings', label: 'Settings', href: '/settings', icon: Settings, match: starts('/settings') },
};

export const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  { label: 'Overview', items: [NAV.overview, NAV.performance] },
  { label: 'Net worth', items: [NAV.portfolio, NAV.loans] },
  { label: 'Planning', items: [NAV.budget, NAV.subscriptions, NAV.upcoming] },
];

export const NAV_BOTTOM: NavItem[] = [NAV.imports, NAV.assistant, NAV.settings];

/** Mobile floating tab bar: Home · Trends · Portfolio · Budget · More */
export const MOBILE_TABS: { item: NavItem; label: string }[] = [
  { item: NAV.overview, label: 'Home' },
  { item: NAV.performance, label: 'Trends' },
  { item: NAV.portfolio, label: 'Portfolio' },
  { item: NAV.budget, label: 'Budget' },
];
export const MOBILE_MORE: NavItem[] = [NAV.loans, NAV.subscriptions, NAV.upcoming, NAV.imports, NAV.assistant, NAV.settings];

/** Extra destinations reachable from ⌘K search */
export const SEARCH_EXTRA: { label: string; href: string; group: string }[] = [
  { label: 'Stocks & funds', href: '/portfolio/stocks', group: 'Portfolio' },
  { label: 'Mutual funds', href: '/portfolio/mutual-funds', group: 'Portfolio' },
  { label: 'Fixed deposits', href: '/portfolio/fixed-deposits', group: 'Portfolio' },
  { label: 'Other investments', href: '/portfolio/investments', group: 'Portfolio' },
  { label: 'Cash & bank', href: '/portfolio/bank-balances', group: 'Portfolio' },
  { label: 'Retirement (EPF + NPS)', href: '/portfolio/provident-fund', group: 'Portfolio' },
  { label: 'Receivables', href: '/portfolio/receivables', group: 'Portfolio' },
  { label: 'Properties', href: '/portfolio/properties', group: 'Portfolio' },
  { label: 'Monthly snapshots', href: '/performance/snapshots', group: 'Performance' },
  { label: 'AI analysis', href: '/data/analysis', group: 'Imports & data' },
  { label: 'Net worth chart', href: '/dashboard/chart', group: 'Dashboard' },
];
