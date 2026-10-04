'use client';

import { useQuery } from '@tanstack/react-query';
import { BankBalance } from '@/shared/types';
import { useState } from 'react';
import { Edit2, Plus, Trash2, Upload, Download } from 'lucide-react';
import { Loader } from '@/shared/components/Loader';
import { Button, DetailRow, Drawer, Panel, Tag } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { BarsPanel, DonutPanel, toSlices } from './ClassCharts';
import { ClassHeader } from './ClassPages';
import { BankBalanceForm } from './BankBalanceForm';
import { usePortfolioCrud } from '../hooks/usePortfolioCrud';
import { RowActions } from './RowActions';
import { DraftTabs, useDraftView } from './DraftFilter';
import { ClosedNotice, fmtDateTime } from './InvestmentClassViews';

const BANK_KEY = ['bankBalances', 'all'];

/** Cash & bank page body: class header with "Add account", charts, accounts table with full CRUD. */
export function BankBalancesDetailView() {
  const [mode, setMode] = useState<Mode>(null);
  const { data: bankBalances = [], isLoading } = useQuery<BankBalance[]>({
    queryKey: BANK_KEY,
    queryFn: async () => {
      const response = await fetch('/api/portfolio/bank-balances');
      if (!response.ok) throw new Error('Failed to fetch bank balances');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const header = <ClassHeader classKey="bank" actions={<Button icon={Plus} onClick={() => setMode({ kind: 'add' })}>Add account</Button>} />;

  if (isLoading) {
    return (
      <>
        {header}
        <Loader text="Loading bank balances data..." size="lg" />
      </>
    );
  }

  // Filter out receivables - they should only appear in the receivables page
  const accounts = bankBalances.filter((balance) => !balance.tags?.includes('receivable'));
  // Charts follow net worth: published, not closed accounts only
  const published = accounts.filter((b) => b.isPublished && b.status !== 'closed');
  const byBank = toSlices(published.map((b) => ({ name: b.bankName, value: b.balance })));
  const byType = toSlices(published.map((b) => ({ name: typeName(b), value: b.balance })), Infinity).map((s) => ({ name: s.name, balance: s.value }));

  return (
    <>
      {header}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <DonutPanel title="By bank" subtitle="Share of balances held at each bank" slices={byBank} centreLabel="Cash" />
        <BarsPanel
          title="By account type"
          subtitle="Total balance in each kind of account"
          rows={byType}
          series={[{ key: 'balance', label: 'Balance', color: 'var(--c-cash)' }]}
        />
      </div>
      <BankAccountsTable balances={accounts} mode={mode} setMode={setMode} />
    </>
  );
}

const typeName = (b: BankBalance) => b.accountType.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
const statusTone = (st: BankBalance['status']) => (st === 'active' ? 'gain' : st === 'closed' ? 'neutral' : 'warn');

type Mode = { kind: 'view'; item: BankBalance } | { kind: 'edit'; item: BankBalance } | { kind: 'add' } | null;

function BankAccountsTable({ balances, mode, setMode }: { balances: BankBalance[]; mode: Mode; setMode: (m: Mode) => void }) {
  const { M, O } = useMoney();
  const [error, setError] = useState('');
  const crud = usePortfolioCrud<BankBalance>('bank-balances', [BANK_KEY]);
  const ccy = (b: BankBalance) => b.originalCurrency || b.currency || 'INR';
  const activeAccounts = balances.filter((b) => b.status === 'active').length;
  const draftView = useDraftView(balances);

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
  const handleDelete = (b: BankBalance) => {
    if (!confirm(`Delete ${b.bankName}${b.accountNumber ? ` ••${b.accountNumber.slice(-4)}` : ''}? This cannot be undone.`)) return;
    attempt(() => crud.remove(b.id));
  };

  const editing = mode?.kind === 'edit' || mode?.kind === 'add';
  const current = mode && mode.kind !== 'add' ? mode.item : null;

  return (
    <Panel flush className="overflow-hidden">
      <div className="px-6 pb-4 pt-[22px]">
        <div>
          <h2 className="text-[19px]">Accounts</h2>
          <p className="mt-1 text-[13px] text-muted">
            {balances.length} accounts · {activeAccounts} active · closed accounts are not counted in net worth · tap a row for details
          </p>
        </div>
        <div className="mt-3">
          <DraftTabs {...draftView} />
        </div>
      </div>
      <DataTable<BankBalance>
        rows={draftView.visible}
        rowKey={(b) => b.id}
        onRowClick={(item) => setMode({ kind: 'view', item })}
        defaultSort={{ key: 'balance', dir: 'desc' }}
        empty={draftView.view === 'draft' ? 'No draft accounts.' : 'No bank accounts yet. Use “Add account” to record your first balance.'}
        columns={[
          {
            key: 'bank',
            label: 'Bank',
            sortValue: (b) => b.bankName,
            render: (b) => (
              <>
                <div className="flex items-center gap-2 font-semibold">
                  {b.bankName}
                  {!b.isPublished && <Tag tone="warn">Draft</Tag>}
                </div>
                {b.accountNumber && <div className="text-[12.5px] text-muted">••{b.accountNumber.slice(-4)}</div>}
              </>
            ),
          },
          { key: 'type', label: 'Type', render: (b) => typeName(b), sortValue: (b) => b.accountType },
          {
            key: 'balance',
            label: 'Balance',
            align: 'right',
            sortValue: (b) => b.balance,
            render: (b) => (
              <>
                <div className="font-semibold">{M(b.balance, 2)}</div>
                {ccy(b) !== 'INR' && <div className="text-[12.5px] text-muted">{O(b.originalAmount ?? b.balance, ccy(b))}</div>}
              </>
            ),
          },
          { key: 'updated', label: 'Updated', render: (b) => fmtDate(b.lastUpdated), sortValue: (b) => b.lastUpdated || '' },
          {
            key: 'status',
            label: 'Status',
            render: (b) => (
              <Tag tone={statusTone(b.status)} className="font-semibold">
                {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
              </Tag>
            ),
          },
          {
            key: 'actions',
            label: '',
            render: (b) => (
              <RowActions
                label={b.bankName}
                onEdit={() => setMode({ kind: 'edit', item: b })}
                isPublished={b.isPublished}
                onTogglePublish={() => attempt(() => crud.setPublished(b.id, !b.isPublished))}
                onDelete={() => handleDelete(b)}
              />
            ),
          },
        ]}
      />
      <Drawer
        open={!!mode}
        onClose={close}
        width={editing ? 640 : 460}
        title={mode?.kind === 'add' ? 'Add bank account' : mode?.kind === 'edit' ? `Edit ${mode.item.bankName}` : current?.bankName}
        subtitle={current && !editing ? `${typeName(current)} account${current.isPublished ? '' : ' · draft'}` : undefined}
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
          <BankBalanceForm
            key={current?.id ?? 'new'}
            initialData={current ?? undefined}
            isSaving={crud.busy}
            onCancel={close}
            onSave={(item) => attempt(() => (current ? crud.update({ ...item, id: current.id }) : crud.create(item)))}
          />
        )}
        {current && !editing && (
          <>
            {current.status === 'closed' && <ClosedNotice what="account" />}
            <DetailRow label="Balance" value={M(current.balance, 2)} />
            {ccy(current) !== 'INR' && <DetailRow label="Original amount" value={O(current.originalAmount ?? current.balance, ccy(current))} />}
            <DetailRow label="Currency" value={ccy(current)} />
            {current.accountNumber && <DetailRow label="Account" value={`••${current.accountNumber.slice(-4)}`} />}
            <DetailRow label="Asset type" value={current.assetType === 'fixed' ? 'Fixed' : 'Liquid'} />
            <DetailRow label="Balance as of" value={fmtDate(current.lastUpdated)} />
            <DetailRow label="Status" value={<Tag tone={statusTone(current.status)}>{current.status}</Tag>} />
            <DetailRow label="Visibility" value={current.status === 'closed' ? 'Closed · not counted in net worth' : current.isPublished ? 'Published · counts toward net worth' : <Tag tone="warn">Draft · not in net worth</Tag>} />
            {current.updatedAt && <DetailRow label="Last updated" value={fmtDateTime(current.updatedAt)} />}
            {current.description && <p className="mt-4 text-[14px] text-muted">{current.description}</p>}
          </>
        )}
      </Drawer>
    </Panel>
  );
}
