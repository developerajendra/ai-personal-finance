'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, PageHeader } from '@/shared/components/ui';
import { PortfolioGrid } from './PortfolioGrid';
import { ReceivablesSummary } from './ReceivablesSummary';

/** Receivables page: header with "Add receivable", summary and charts, and the receivables table. */
export function ReceivablesPageBody() {
  const [addRequest, setAddRequest] = useState(0);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Portfolio', href: '/portfolio' }, { label: 'Receivables' }]}
        title="Receivables"
        meta="Track money owed to you"
        actions={<Button icon={Plus} onClick={() => setAddRequest((n) => n + 1)}>Add receivable</Button>}
      />
      <ReceivablesSummary />
      <PortfolioGrid lockedTab="receivables" addRequest={addRequest} />
    </>
  );
}
