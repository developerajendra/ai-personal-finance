'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Investment, PPFAccount } from "@/shared/types";
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { Button, Drawer, EmptyState, LinkButton, Panel, Tag } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { isRetirementInvestment } from '@/shared/hooks/usePortfolioTotals';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';
import { Loader } from '@/shared/components/Loader';
import { ProvidentFundEditForm } from './ProvidentFundEditForm';
import { ClassHeader } from './ClassPages';
import { BarsPanel, DonutPanel, SERIES_COLORS } from './ClassCharts';
import { RetirementAccountForm, retirementTypeLabel } from './RetirementAccountForm';
import { RowActions } from './RowActions';
import { DraftTabs, useDraftView } from './DraftFilter';
import { ClosedNotice, fmtDateTime } from './InvestmentClassViews';
import { usePortfolioCrud } from '../hooks/usePortfolioCrud';
import { format } from 'date-fns';

const INVESTMENTS_KEY = ['investments', 'all'];

type RetMode = { kind: 'edit'; item: Investment } | { kind: 'add' } | null;

/** Retirement page: provident fund (EPFO passbooks) plus manually added NPS / PF / other accounts (CRUD). */
export function RetirementView() {
  const [mode, setMode] = useState<RetMode>(null);
  const { data: accounts = [], isLoading: pfLoading } = useQuery<PPFAccount[]>({
    queryKey: ['ppfAccounts'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/ppf-accounts');
      if (!response.ok) throw new Error('Failed to fetch PPF accounts');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });
  const { data: investments = [], isLoading: invLoading } = useQuery<Investment[]>({
    queryKey: INVESTMENTS_KEY,
    queryFn: async () => {
      const response = await fetch('/api/portfolio/investments');
      if (!response.ok) throw new Error('Failed to fetch investments');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const header = (
    <ClassHeader classKey="pf" actions={<Button icon={Plus} onClick={() => setMode({ kind: 'add' })}>Add new account</Button>} />
  );

  if (pfLoading || invLoading) {
    return (
      <>
        {header}
        <Loader text="Loading retirement accounts..." size="lg" />
      </>
    );
  }

  const manualAccounts = investments.filter(isRetirementInvestment);
  // Charts follow net worth: every EPFO passbook plus published, not-closed manual accounts — one bar / slice each
  const pfRows = accounts.map((a) => {
    const net = (a.depositEmployeeShare || 0) - (a.withdrawEmployeeShare || 0) + (a.depositEmployerShare || 0) - (a.withdrawEmployerShare || 0) + (a.pensionContribution || 0);
    const value = a.grandTotal || 0;
    return { name: `${shortName(a.establishmentName || 'Unknown')} PF`, invested: Math.min(net, value), value };
  });
  const manualRows = manualAccounts
    .filter((i) => i.isPublished && i.status !== 'closed')
    .map((i) => ({ name: i.name, invested: i.amount || 0, value: getCurrentInvestmentValue(i) }));
  const groups = [...pfRows, ...manualRows]
    .filter((g) => g.value > 0)
    .map((g, idx) => ({ ...g, growth: Math.max(0, g.value - g.invested), color: SERIES_COLORS[idx % SERIES_COLORS.length] }));

  return (
    <>
      {header}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <DonutPanel title="Retirement mix" subtitle="Share of current value by account" slices={groups} centreLabel="Corpus" />
        <BarsPanel
          title="Invested vs growth"
          subtitle="Contributions and the interest or returns earned on them"
          rows={groups.map((g) => ({ name: g.name, invested: g.invested, growth: g.growth }))}
          series={[
            { key: 'invested', label: 'Invested', color: 'var(--c-ret)' },
            { key: 'growth', label: 'Growth', color: 'var(--color-accent)' },
          ]}
          stacked
        />
      </div>
      <div className="space-y-4">
        <ProvidentFundDetailView />
        <RetirementAccountsTable accounts={manualAccounts} mode={mode} setMode={setMode} />
      </div>
    </>
  );
}

/** Chart label for an employer: "INTELLIGRAPE SOFTWARE PVT LTD" → "Intelligrape"; acronyms like "TTN" stay as they are. */
function shortName(name: string) {
  const first = name.trim().split(/\s+/)[0] || name;
  return first.length <= 4 ? first : first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function RetirementAccountsTable({ accounts, mode, setMode }: { accounts: Investment[]; mode: RetMode; setMode: (m: RetMode) => void }) {
  const { M, S } = useMoney();
  const [error, setError] = useState('');
  const crud = usePortfolioCrud<Investment>('investments', [INVESTMENTS_KEY]);

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
  const handleDelete = (i: Investment) => {
    if (!confirm(`Delete “${i.name}”? This cannot be undone.`)) return;
    attempt(() => crud.remove(i.id));
  };
  const current = mode?.kind === 'edit' ? mode.item : null;
  const draftView = useDraftView(accounts);

  return (
    <Panel flush className="overflow-hidden">
      <div className="px-6 pb-4 pt-[22px]">
        <h2 className="text-[19px]">Other retirement accounts</h2>
        <p className="mt-1 text-[13px] text-muted">NPS, PF and other balances added by hand from your statements · closed accounts are not counted · tap a row to edit</p>
        {accounts.length > 0 && (
          <div className="mt-3">
            <DraftTabs {...draftView} />
          </div>
        )}
      </div>
      {accounts.length === 0 ? (
        <div className="px-6 pb-6">
          <EmptyState title="No accounts added yet" action={<Button icon={Plus} onClick={() => setMode({ kind: 'add' })}>Add new account</Button>}>
            Add an NPS, PF or other retirement balance to include it in your retirement corpus and net worth.
          </EmptyState>
        </div>
      ) : (
        <DataTable<Investment>
          rows={draftView.visible}
          rowKey={(i) => i.id}
          empty={draftView.view === 'draft' ? 'No draft accounts.' : 'No published accounts.'}
          onRowClick={(item) => setMode({ kind: 'edit', item })}
          defaultSort={{ key: 'value', dir: 'desc' }}
          columns={[
            {
              key: 'name',
              label: 'Account',
              sortValue: (i) => i.name,
              render: (i) => (
                <>
                  <div className="flex items-center gap-2 font-semibold">
                    {i.name}
                    {!i.isPublished && <Tag tone="warn">Draft</Tag>}
                    {i.status === 'closed' && <Tag>Closed</Tag>}
                    {i.status === 'matured' && <Tag tone="accent">Matured</Tag>}
                  </div>
                  {i.description && <div className="max-w-[260px] truncate text-[12.5px] text-muted">{i.description}</div>}
                </>
              ),
            },
            { key: 'type', label: 'Type', render: (i) => <Tag>{retirementTypeLabel(i.type)}</Tag>, sortValue: (i) => retirementTypeLabel(i.type) },
            { key: 'invested', label: 'Balance entered', align: 'right', render: (i) => M(i.amount), sortValue: (i) => i.amount },
            {
              key: 'value',
              label: 'Current value',
              align: 'right',
              sortValue: getCurrentInvestmentValue,
              render: (i) => {
                const v = getCurrentInvestmentValue(i);
                return (
                  <>
                    <div className="font-semibold">{M(v)}</div>
                    {v - i.amount > 0.5 && <div className="text-[12.5px] text-gain">{S(v - i.amount)}</div>}
                  </>
                );
              },
            },
            { key: 'rate', label: 'Expected return', align: 'right', render: (i) => (i.interestRate != null ? `${i.interestRate}%` : '—'), sortValue: (i) => i.interestRate ?? -1 },
            { key: 'since', label: 'As of', render: (i) => fmtDate(i.startDate), sortValue: (i) => i.startDate },
            {
              key: 'actions',
              label: '',
              render: (i) => (
                <RowActions
                  label={i.name}
                  onEdit={() => setMode({ kind: 'edit', item: i })}
                  isPublished={i.isPublished}
                  onTogglePublish={() => attempt(() => crud.setPublished(i.id, !i.isPublished))}
                  onDelete={() => handleDelete(i)}
                />
              ),
            },
          ]}
        />
      )}
      <Drawer
        open={!!mode}
        onClose={close}
        width={640}
        title={current ? `Edit ${current.name}` : 'Add new account'}
        subtitle={
          current
            ? `${retirementTypeLabel(current.type)}${current.isPublished ? '' : ' · draft'}${current.updatedAt ? ` · last updated ${fmtDateTime(current.updatedAt)}` : ''}`
            : 'NPS, PF or other retirement account'
        }
        footer={
          current ? (
            <Button variant="danger" icon={Trash2} disabled={crud.busy} onClick={() => handleDelete(current)}>
              Delete account
            </Button>
          ) : undefined
        }>
        {error && <p role="alert" className="mb-4 rounded-lg bg-loss-bg p-3 text-[13.5px] text-loss">{error}</p>}
        {current?.status === 'closed' && <ClosedNotice what="account" />}
        {mode && (
          <RetirementAccountForm
            key={current?.id ?? 'new'}
            investment={current ?? undefined}
            isSaving={crud.busy}
            onCancel={close}
            onSave={(item) => attempt(() => (current ? crud.update(item) : crud.create(item)))}
          />
        )}
      </Drawer>
    </Panel>
  );
}


export function ProvidentFundDetailView() {
  const queryClient = useQueryClient();
  const [editingAccount, setEditingAccount] = useState<PPFAccount | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { M } = useMoney();

  const { data: accounts = [], isLoading } = useQuery<PPFAccount[]>({
    queryKey: ['ppfAccounts'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/ppf-accounts');
      if (!response.ok) throw new Error('Failed to fetch PPF accounts');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const handleSave = async (account: PPFAccount) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/portfolio/ppf-accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ppfAccounts'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-snapshot'] }),
      ]);
      setEditingAccount(null);
    } catch (err) {
      console.error('Error saving PPF account:', err);
      alert(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading EPF passbooks..." size="lg" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="No EPFO passbooks yet"
          action={<LinkButton href="/data/upload" variant="secondary">Go to imports</LinkButton>}
        >
          Upload EPFO passbook PDFs from Imports &amp; data (import type: Provident fund) to track employer PF automatically.
        </EmptyState>
      </Panel>
    );
  }

  const totalAccounts = accounts.length;

  return (
    <>
      <Panel flush className="overflow-hidden">
        <div className="px-6 pb-4 pt-[22px]">
          <h2 className="text-[19px]">Provident fund</h2>
          <p className="mt-1 text-[13px] text-muted">{totalAccounts} accounts from EPFO passbooks · tap a row to edit</p>
        </div>
        <DataTable<PPFAccount>
          rows={accounts}
          rowKey={(a) => a.id}
          onRowClick={setEditingAccount}
          defaultSort={{ key: 'total', dir: 'desc' }}
          columns={[
            {
              key: 'est',
              label: 'Establishment',
              sortValue: (a) => a.establishmentName || '',
              render: (a) => (
                <>
                  <div className="font-semibold">{a.establishmentName || 'Unknown'}</div>
                  <div className="text-[12.5px] text-muted">{a.memberId || a.memberName || '—'}</div>
                </>
              ),
            },
            { key: 'emp', label: 'Employee share', align: 'right', render: (a) => M((a.depositEmployeeShare || 0) - (a.withdrawEmployeeShare || 0)), sortValue: (a) => a.depositEmployeeShare || 0 },
            { key: 'er', label: 'Employer share', align: 'right', render: (a) => M((a.depositEmployerShare || 0) - (a.withdrawEmployerShare || 0)), sortValue: (a) => a.depositEmployerShare || 0 },
            { key: 'pension', label: 'Pension', align: 'right', render: (a) => M(a.pensionContribution || 0), sortValue: (a) => a.pensionContribution || 0 },
            { key: 'total', label: 'Grand total', align: 'right', render: (a) => <span className="font-semibold">{M(a.grandTotal || 0)}</span>, sortValue: (a) => a.grandTotal || 0 },
            { key: 'upd', label: 'Updated', render: (a) => formatDate(a.lastUpdated || a.extractedAt), sortValue: (a) => a.lastUpdated || a.extractedAt || '' },
            {
              key: 'edit',
              label: '',
              render: (a) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingAccount(a);
                  }}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-accent-700 hover:bg-accent-100"
                  title="Edit PF account"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
              ),
            },
          ]}
        />
      </Panel>

      {/* Edit PPF Account — opens in the right-side drawer */}
      <Drawer
        open={!!editingAccount}
        onClose={() => !isSaving && setEditingAccount(null)}
        title="Edit PF account"
        subtitle={editingAccount?.establishmentName}
        width={640}
      >
        {editingAccount && (
          <ProvidentFundEditForm
            account={editingAccount}
            onSave={handleSave}
            onCancel={() => !isSaving && setEditingAccount(null)}
            isSaving={isSaving}
          />
        )}
      </Drawer>
    </>
  );
}
