'use client';

import { useQuery } from '@tanstack/react-query';
import { Loan } from '@/shared/types';
import { useState } from 'react';
import { Loader } from '@/shared/components/Loader';
import { DetailRow, Drawer, Panel, PanelHeader, Tag } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { BreakdownPanel } from './BreakdownPanel';

export function LoansDetailView() {
  const { data: loans = [], isLoading } = useQuery<Loan[]>({
    queryKey: ['loans', 'published'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/loans?isPublished=true');
      if (!response.ok) throw new Error('Failed to fetch loans');
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const { M } = useMoney();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading loans data..." size="lg" />
      </div>
    );
  }

  const totalOutstanding = loans.reduce((sum, loan) => sum + loan.outstandingAmount, 0);
  const totalPrincipal = loans.reduce((sum, loan) => sum + loan.principalAmount, 0);
  const totalEMI = loans.reduce((sum, loan) => sum + loan.emiAmount, 0);
  const activeLoans = loans.filter((loan) => loan.status === 'active').length;
  const totalPaid = totalPrincipal - totalOutstanding;

  const loanTypeBreakdown = loans.reduce((acc, loan) => {
    const typeName = loan.type.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    acc[typeName] = (acc[typeName] || 0) + loan.outstandingAmount;
    return acc;
  }, {} as Record<string, number>);

  const loanChartData = Object.entries(loanTypeBreakdown).map(([name, value]) => ({
    name,
    value,
  }));


  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <LoansTable loans={loans} activeLoans={activeLoans} totalEMI={totalEMI} />
      <div className="space-y-4">
        <Panel>
          <PanelHeader title="Repayment" />
          <DetailRow label="Disbursed" value={M(totalPrincipal)} />
          <DetailRow label="Repaid" value={M(totalPaid)} />
          <DetailRow label="Outstanding" value={M(totalOutstanding)} />
          <DetailRow label="EMI per month" value={M(totalEMI)} />
        </Panel>
        <BreakdownPanel title="By loan type" items={loanChartData} color="var(--c-loan)" />
      </div>
    </div>
  );
}

const titleCase = (v: string) => v.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

function LoansTable({ loans, activeLoans, totalEMI }: { loans: Loan[]; activeLoans: number; totalEMI: number }) {
  const { M } = useMoney();
  const [open, setOpen] = useState<Loan | null>(null);
  const statusTone = (st: Loan['status']) => (st === 'active' ? 'accent' : st === 'closed' ? 'gain' : 'neutral');
  return (
    <Panel flush className="overflow-hidden">
      <div className="px-6 pb-4 pt-[22px]">
        <h2 className="text-[19px]">All loans</h2>
        <p className="mt-1 text-[13px] text-muted">
          {loans.length} loans · {activeLoans} active · EMI {M(totalEMI)}/month
        </p>
      </div>
      <DataTable<Loan>
        rows={loans}
        rowKey={(l) => l.id}
        onRowClick={setOpen}
        defaultSort={{ key: 'out', dir: 'desc' }}
        empty="No loans data available. Add loans in the Portfolio section."
        columns={[
          { key: 'name', label: 'Loan', sortValue: (l) => l.name, render: (l) => (<><div className="font-semibold">{l.name}</div><div className="text-[12.5px] text-muted">{titleCase(l.type)}</div></>) },
          { key: 'principal', label: 'Principal', align: 'right', render: (l) => M(l.principalAmount), sortValue: (l) => l.principalAmount },
          { key: 'out', label: 'Outstanding', align: 'right', render: (l) => <span className="font-semibold">{M(l.outstandingAmount)}</span>, sortValue: (l) => l.outstandingAmount },
          { key: 'emi', label: 'EMI', align: 'right', render: (l) => M(l.emiAmount), sortValue: (l) => l.emiAmount },
          { key: 'rate', label: 'Rate', align: 'right', render: (l) => `${l.interestRate}%`, sortValue: (l) => l.interestRate },
          { key: 'tenure', label: 'Tenure', align: 'right', render: (l) => `${l.tenureMonths} mo`, sortValue: (l) => l.tenureMonths },
          { key: 'status', label: 'Status', render: (l) => <Tag tone={statusTone(l.status)} className="font-semibold">{titleCase(l.status)}</Tag> },
        ]}
      />
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.name} subtitle={open ? titleCase(open.type) : undefined}>
        {open && (
          <>
            <DetailRow label="Outstanding" value={M(open.outstandingAmount, 2)} />
            <DetailRow label="Principal" value={M(open.principalAmount)} />
            <DetailRow label="EMI" value={`${M(open.emiAmount)} on day ${open.emiDate}`} />
            <DetailRow label="Interest rate" value={`${open.interestRate}%`} />
            <DetailRow label="Tenure" value={`${open.tenureMonths} months`} />
            <DetailRow label="Started" value={fmtDate(open.startDate)} />
            {open.endDate && <DetailRow label="Ends" value={fmtDate(open.endDate)} />}
            {open.description && <p className="mt-4 text-[14px] text-muted">{open.description}</p>}
            <p className="mt-6 text-[13px] text-muted">Edit or publish loans from the Portfolio overview → Loans tab.</p>
          </>
        )}
      </Drawer>
    </Panel>
  );
}
