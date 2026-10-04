'use client';

import { useQuery } from '@tanstack/react-query';
import { Loan } from '@/shared/types';
import { useState } from 'react';
import { Download, Edit2, Plus, Trash2, Upload } from 'lucide-react';
import { Loader } from '@/shared/components/Loader';
import { Button, DetailRow, Drawer, PageHeader, Panel, PanelHeader, Tag } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { BreakdownPanel } from './BreakdownPanel';
import { LoanForm } from './LoanForm';
import { LoanHero } from './LoanHero';
import { LoanAnalyticsModule } from './LoanAnalyticsModule';
import { RowActions } from './RowActions';
import { usePortfolioCrud } from '../hooks/usePortfolioCrud';

const LOANS_KEY = ['loans', 'all'];

type Mode = { kind: 'view'; item: Loan } | { kind: 'edit'; item: Loan } | { kind: 'add' } | null;

/** Loans page: header with "Add loan", hero, analytics, and the loans table with full CRUD. */
export function LoansPageBody() {
  const [mode, setMode] = useState<Mode>(null);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Loans' }]}
        title="Loans"
        meta={false}
        actions={<Button icon={Plus} onClick={() => setMode({ kind: 'add' })}>Add loan</Button>}
      />
      <LoanHero />
      <LoanAnalyticsModule />
      <div className="mt-6">
        <LoansDetailView mode={mode} setMode={setMode} />
      </div>
    </>
  );
}

export function LoansDetailView({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const { data: loans = [], isLoading } = useQuery<Loan[]>({
    queryKey: LOANS_KEY,
    queryFn: async () => {
      const response = await fetch('/api/portfolio/loans');
      if (!response.ok) throw new Error('Failed to fetch loans');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const { M } = useMoney();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading loans data..." size="lg" />
      </div>
    );
  }

  // Totals follow net worth: published loans only
  const published = loans.filter((l) => l.isPublished);
  const totalOutstanding = published.reduce((sum, loan) => sum + loan.outstandingAmount, 0);
  const totalPrincipal = published.reduce((sum, loan) => sum + loan.principalAmount, 0);
  const totalEMI = published.filter((l) => l.status === 'active').reduce((sum, loan) => sum + loan.emiAmount, 0);
  const totalPaid = totalPrincipal - totalOutstanding;

  const loanChartData = Object.entries(
    published.reduce((acc, loan) => {
      acc[titleCase(loan.type)] = (acc[titleCase(loan.type)] || 0) + loan.outstandingAmount;
      return acc;
    }, {} as Record<string, number>),
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <LoansTable loans={loans} totalEMI={totalEMI} mode={mode} setMode={setMode} />
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

function LoansTable({ loans, totalEMI, mode, setMode }: { loans: Loan[]; totalEMI: number; mode: Mode; setMode: (m: Mode) => void }) {
  const { M } = useMoney();
  const [error, setError] = useState('');
  const crud = usePortfolioCrud<Loan>('loans', [LOANS_KEY]);
  const statusTone = (st: Loan['status']) => (st === 'active' ? 'accent' : st === 'closed' ? 'gain' : 'neutral');
  const activeLoans = loans.filter((l) => l.status === 'active').length;
  const drafts = loans.filter((l) => !l.isPublished).length;

  const close = () => {
    if (crud.busy) return;
    setMode(null);
    setError('');
  };
  const attempt = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      setMode(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong';
      // Row actions run with no drawer open, so there is nowhere inline to show the error
      if (mode) setError(message);
      else alert(message);
    }
  };
  const handleDelete = (l: Loan) => {
    if (!confirm(`Delete “${l.name}”? This cannot be undone.`)) return;
    attempt(() => crud.remove(l.id));
  };

  const editing = mode?.kind === 'edit' || mode?.kind === 'add';
  const current = mode && mode.kind !== 'add' ? mode.item : null;

  return (
    <Panel flush className="overflow-hidden">
      <div className="px-6 pb-4 pt-[22px]">
        <h2 className="text-[19px]">All loans</h2>
        <p className="mt-1 text-[13px] text-muted">
          {loans.length} loans · {activeLoans} active{drafts > 0 && ` · ${drafts} draft${drafts === 1 ? '' : 's'}`} · EMI {M(totalEMI)}/month · tap a row for details
        </p>
      </div>
      <DataTable<Loan>
        rows={loans}
        rowKey={(l) => l.id}
        onRowClick={(item) => setMode({ kind: 'view', item })}
        defaultSort={{ key: 'out', dir: 'desc' }}
        empty="No loans yet. Use “Add loan” to record one."
        columns={[
          {
            key: 'name',
            label: 'Loan',
            sortValue: (l) => l.name,
            render: (l) => (
              <>
                <div className="flex items-center gap-2 font-semibold">
                  {l.name}
                  {!l.isPublished && <Tag tone="warn">Draft</Tag>}
                </div>
                <div className="text-[12.5px] text-muted">{titleCase(l.type)}</div>
              </>
            ),
          },
          { key: 'principal', label: 'Principal', align: 'right', render: (l) => M(l.principalAmount), sortValue: (l) => l.principalAmount },
          { key: 'out', label: 'Outstanding', align: 'right', render: (l) => <span className="font-semibold">{M(l.outstandingAmount)}</span>, sortValue: (l) => l.outstandingAmount },
          { key: 'emi', label: 'EMI', align: 'right', render: (l) => M(l.emiAmount), sortValue: (l) => l.emiAmount },
          { key: 'rate', label: 'Rate', align: 'right', render: (l) => `${l.interestRate}%`, sortValue: (l) => l.interestRate },
          { key: 'tenure', label: 'Tenure', align: 'right', render: (l) => `${l.tenureMonths} mo`, sortValue: (l) => l.tenureMonths },
          { key: 'status', label: 'Status', render: (l) => <Tag tone={statusTone(l.status)} className="font-semibold">{titleCase(l.status)}</Tag> },
          {
            key: 'actions',
            label: '',
            render: (l) => <RowActions label={l.name} onEdit={() => setMode({ kind: 'edit', item: l })} onDelete={() => handleDelete(l)} />,
          },
        ]}
      />
      <Drawer
        open={!!mode}
        onClose={close}
        width={editing ? 640 : 460}
        title={mode?.kind === 'add' ? 'Add loan' : mode?.kind === 'edit' ? `Edit ${mode.item.name}` : current?.name}
        subtitle={current && !editing ? `${titleCase(current.type)}${current.isPublished ? '' : ' · draft'}` : undefined}
        footer={
          current && !editing ? (
            <>
              <Button variant="danger" icon={Trash2} disabled={crud.busy} onClick={() => handleDelete(current)}>
                Delete
              </Button>
              <Button
                variant="secondary"
                icon={current.isPublished ? Download : Upload}
                disabled={crud.busy}
                onClick={() => attempt(() => crud.setPublished(current.id, !current.isPublished))}>
                {current.isPublished ? 'Move to draft' : 'Publish'}
              </Button>
              <Button icon={Edit2} disabled={crud.busy} onClick={() => setMode({ kind: 'edit', item: current })}>
                Edit
              </Button>
            </>
          ) : undefined
        }>
        {error && <p role="alert" className="mb-4 rounded-lg bg-loss-bg p-3 text-[13.5px] text-loss">{error}</p>}
        {editing && (
          <LoanForm
            key={current?.id ?? 'new'}
            loan={current ?? undefined}
            isSaving={crud.busy}
            onCancel={close}
            onSave={(item) => attempt(() => (current ? crud.update({ ...item, id: current.id }) : crud.create(item)))}
          />
        )}
        {current && !editing && (
          <>
            <DetailRow label="Outstanding" value={M(current.outstandingAmount, 2)} />
            <DetailRow label="Principal" value={M(current.principalAmount)} />
            <DetailRow label="EMI" value={`${M(current.emiAmount)} on day ${current.emiDate}`} />
            <DetailRow label="Interest rate" value={`${current.interestRate}%`} />
            <DetailRow label="Tenure" value={`${current.tenureMonths} months`} />
            <DetailRow label="Started" value={fmtDate(current.startDate)} />
            {current.endDate && <DetailRow label="Ends" value={fmtDate(current.endDate)} />}
            <DetailRow label="Visibility" value={current.isPublished ? 'Published · counts toward net worth' : <Tag tone="warn">Draft · not in net worth</Tag>} />
            {current.description && <p className="mt-4 text-[14px] text-muted">{current.description}</p>}
          </>
        )}
      </Drawer>
    </Panel>
  );
}
