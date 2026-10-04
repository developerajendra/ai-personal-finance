'use client';

import { useQuery } from '@tanstack/react-query';
import { Loan } from '@/shared/types';
import { useMemo, useState } from 'react';
import { Download, Edit2, Plus, Trash2, Upload } from 'lucide-react';
import { Loader } from '@/shared/components/Loader';
import { Button, DetailRow, Drawer, PageHeader, Panel, Segmented, Tag } from '@/shared/components/ui';
import { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { BarsPanel, DonutPanel, toSlices } from './ClassCharts';
import { LoanForm } from './LoanForm';
import { LoanHero } from './LoanHero';
import { LoanAnalyticsModule, fetchLoanSnapshots } from './LoanAnalyticsModule';
import { RowActions } from './RowActions';
import { DraftTabs, useDraftView } from './DraftFilter';
import { ClosedNotice, fmtDateTime } from './InvestmentClassViews';
import { usePortfolioCrud } from '../hooks/usePortfolioCrud';

const LOANS_KEY = ['loans', 'all'];

type Mode = { kind: 'view'; item: Loan } | { kind: 'edit'; item: Loan } | { kind: 'add' } | null;

/**
 * Loans page: header with "Add loan", summary charts across every loan, then a loan + year
 * filter that drives the hero and analytics, and the loans table with full CRUD.
 */
export function LoansPageBody() {
  const [mode, setMode] = useState<Mode>(null);
  const t = usePortfolioTotals();
  const { data: snapData } = useQuery({ queryKey: ['loan-analytics-snapshots'], queryFn: fetchLoanSnapshots });
  const loans = useMemo(() => [...t.activeLoans].sort((a, b) => b.outstandingAmount - a.outstandingAmount), [t.activeLoans]);
  const [selId, setSelId] = useState<string | null>(null);
  const [yearSel, setYearSel] = useState<string>('all');
  const loan = loans.find((l) => l.id === selId) ?? loans[0];

  // Years with snapshots for the selected loan, latest first
  const years = useMemo(
    () =>
      Array.from(new Set((snapData?.snapshots ?? []).filter((x) => loan && x.snapshot.loanId === loan.id).map((x) => String(x.snapshot.year)))).sort(
        (a, b) => Number(b) - Number(a),
      ),
    [snapData, loan],
  );
  // Fall back to "All years" when the chosen year has no data for this loan
  const year = years.includes(yearSel) ? yearSel : 'all';

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Loans' }]}
        title="Loans"
        meta={false}
        actions={<Button icon={Plus} onClick={() => setMode({ kind: 'add' })}>Add loan</Button>}
      />
      <LoanSummaryCharts />
      {loan && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {loans.length > 1 && (
            <Segmented value={loan.id} onChange={setSelId} options={loans.map((l) => ({ value: l.id, label: l.name }))} ariaLabel="Loan" />
          )}
          {years.length > 0 && (
            <Segmented
              value={year}
              onChange={setYearSel}
              options={[{ value: 'all', label: 'All years' }, ...years.map((y) => ({ value: y, label: y }))]}
              ariaLabel="Year"
            />
          )}
        </div>
      )}
      <LoanHero loan={loan} year={year === 'all' ? null : Number(year)} />
      <LoanAnalyticsModule loanId={loan?.id ?? null} year={year === 'all' ? null : Number(year)} />
      <div className="mt-6">
        <LoansDetailView mode={mode} setMode={setMode} />
      </div>
    </>
  );
}

function useAllLoans() {
  return useQuery<Loan[]>({
    queryKey: LOANS_KEY,
    queryFn: async () => {
      const response = await fetch('/api/portfolio/loans');
      if (!response.ok) throw new Error('Failed to fetch loans');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });
}

/** Outstanding by loan type and repaid vs outstanding, across every published loan (home, car, …). */
function LoanSummaryCharts() {
  const { data: loans = [] } = useAllLoans();
  // Charts follow net worth: published, active loans only
  const owing = loans.filter((l) => l.isPublished && l.status === 'active' && l.outstandingAmount > 0);
  if (owing.length === 0) return null;
  const byType = toSlices(owing.map((l) => ({ name: titleCase(l.type), value: l.outstandingAmount })));
  const repayment = [...owing]
    .sort((a, b) => b.principalAmount - a.principalAmount)
    .map((l) => ({ name: l.name, repaid: Math.max(0, l.principalAmount - l.outstandingAmount), outstanding: l.outstandingAmount }));

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <DonutPanel title="By loan type" subtitle="Share of the outstanding balance" slices={byType} centreLabel="Owed" />
      <BarsPanel
        title="Repaid vs outstanding"
        subtitle="Principal paid back so far and what is still owed on each loan"
        rows={repayment}
        series={[
          { key: 'repaid', label: 'Repaid', color: 'var(--color-accent)' },
          { key: 'outstanding', label: 'Outstanding', color: 'var(--c-loan)' },
        ]}
        stacked
      />
    </div>
  );
}

export function LoansDetailView({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const { data: loans = [], isLoading } = useAllLoans();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading loans data..." size="lg" />
      </div>
    );
  }

  const totalEMI = loans.filter((l) => l.isPublished && l.status === 'active').reduce((sum, loan) => sum + loan.emiAmount, 0);
  return <LoansTable loans={loans} totalEMI={totalEMI} mode={mode} setMode={setMode} />;
}

const titleCase = (v: string) => v.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

function LoansTable({ loans, totalEMI, mode, setMode }: { loans: Loan[]; totalEMI: number; mode: Mode; setMode: (m: Mode) => void }) {
  const { M } = useMoney();
  const [error, setError] = useState('');
  const crud = usePortfolioCrud<Loan>('loans', [LOANS_KEY]);
  const statusTone = (st: Loan['status']) => (st === 'active' ? 'accent' : st === 'closed' ? 'gain' : 'neutral');
  const activeLoans = loans.filter((l) => l.status === 'active').length;
  const draftView = useDraftView(loans);

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
          {loans.length} loans · {activeLoans} active · EMI {M(totalEMI)}/month · closed loans are not counted · tap a row for details
        </p>
        <div className="mt-3">
          <DraftTabs {...draftView} />
        </div>
      </div>
      <DataTable<Loan>
        rows={draftView.visible}
        rowKey={(l) => l.id}
        onRowClick={(item) => setMode({ kind: 'view', item })}
        defaultSort={{ key: 'out', dir: 'desc' }}
        empty={draftView.view === 'draft' ? 'No draft loans.' : 'No loans yet. Use “Add loan” to record one.'}
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
            render: (l) => (
              <RowActions
                label={l.name}
                onEdit={() => setMode({ kind: 'edit', item: l })}
                isPublished={l.isPublished}
                onTogglePublish={() => attempt(() => crud.setPublished(l.id, !l.isPublished))}
                onDelete={() => handleDelete(l)}
              />
            ),
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
            {current.status !== 'active' && <ClosedNotice what="loan" />}
            <DetailRow label="Outstanding" value={M(current.outstandingAmount, 2)} />
            <DetailRow label="Principal" value={M(current.principalAmount)} />
            <DetailRow label="EMI" value={`${M(current.emiAmount)} on day ${current.emiDate}`} />
            <DetailRow label="Interest rate" value={`${current.interestRate}%`} />
            <DetailRow label="Tenure" value={`${current.tenureMonths} months`} />
            <DetailRow label="Started" value={fmtDate(current.startDate)} />
            {current.endDate && <DetailRow label="Ends" value={fmtDate(current.endDate)} />}
            <DetailRow label="Visibility" value={current.status !== 'active' ? `${titleCase(current.status)} · not counted in net worth` : current.isPublished ? 'Published · counts toward net worth' : <Tag tone="warn">Draft · not in net worth</Tag>} />
            {current.updatedAt && <DetailRow label="Last updated" value={fmtDateTime(current.updatedAt)} />}
            {current.description && <p className="mt-4 text-[14px] text-muted">{current.description}</p>}
          </>
        )}
      </Drawer>
    </Panel>
  );
}
