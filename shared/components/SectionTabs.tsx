'use client';

import { usePathname } from 'next/navigation';
import { UnderlineTabs } from '@/shared/components/ui';

/** Route-backed tab bars that group related screens, as in the design's sections. */

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
