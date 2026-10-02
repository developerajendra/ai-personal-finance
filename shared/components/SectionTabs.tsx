'use client';

import { usePathname } from 'next/navigation';
import { UnderlineTabs } from '@/shared/components/ui';
import { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';

/** Route-backed tab bars that group related screens, as in the design's sections. */

export function CashFlowTabs() {
  const path = usePathname() || '';
  return (
    <UnderlineTabs
      className="mb-6"
      value={path}
      tabs={[
        { value: '/transactions', label: 'Transactions', href: '/transactions' },
        { value: '/transactions/subscriptions', label: 'Subscriptions', href: '/transactions/subscriptions' },
        { value: '/dashboard/archive', label: 'Monthly snapshots', href: '/dashboard/archive' },
        { value: '/transactions/categories', label: 'Categories', href: '/transactions/categories' },
      ]}
    />
  );
}

export function LoansTabs() {
  const path = usePathname() || '';
  const t = usePortfolioTotals();
  return (
    <UnderlineTabs
      className="mb-6"
      value={path}
      tabs={[
        { value: '/portfolio/loans', label: 'Loans', count: t.activeLoans.length, href: '/portfolio/loans' },
        { value: '/portfolio/receivables', label: 'Receivables', count: t.receivables.length, href: '/portfolio/receivables' },
      ]}
    />
  );
}

export function ImportsTabs() {
  const path = usePathname() || '';
  return (
    <UnderlineTabs
      className="mb-6"
      value={path}
      tabs={[
        { value: '/data/upload', label: 'Imports & connections', href: '/data/upload' },
        { value: '/data/analysis', label: 'AI analysis', href: '/data/analysis' },
      ]}
    />
  );
}
