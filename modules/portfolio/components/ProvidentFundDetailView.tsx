'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Investment, PPFAccount } from "@/shared/types";
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { Button, DetailRow, Drawer, EmptyState, LinkButton, Panel, PanelHeader, Tag } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { isRetirementInvestment } from '@/shared/hooks/usePortfolioTotals';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';
import { BreakdownPanel } from './BreakdownPanel';
import { Loader } from '@/shared/components/Loader';
import { ProvidentFundEditForm } from './ProvidentFundEditForm';
import { ClassHeader } from './ClassPages';
import { BarsPanel, DonutPanel } from './ClassCharts';
import { RetirementForm, RETIREMENT_SCHEMES, schemeLabel } from './RetirementForm';
import { RowActions } from './RowActions';
import { usePortfolioCrud } from '../hooks/usePortfolioCrud';
import { format } from 'date-fns';

const INVESTMENTS_KEY = ['investments', 'all'];
/** Chart colour per scheme; EPFO passbooks share the EPF / PF colour. */
const SCHEME_COLOR: Record<string, string> = {
  epf: 'var(--color-accent)',
  ppf: 'var(--c-dep)',
  nps: 'var(--c-ret)',
  'retirement-other': 'var(--c-prop)',
};

type RetMode = { kind: 'edit'; item: Investment } | { kind: 'add' } | null;

/** Retirement page: header with "Add retirement account", charts, manual schemes (CRUD) and EPFO passbooks. */
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
    <ClassHeader classKey="pf" actions={<Button icon={Plus} onClick={() => setMode({ kind: 'add' })}>Add retirement account</Button>} />
  );

  if (pfLoading || invLoading) {
    return (
      <>
        {header}
        <Loader text="Loading retirement accounts..." size="lg" />
      </>
    );
  }

  const schemes = investments.filter(isRetirementInvestment);
  // Charts follow net worth: published, not-closed schemes plus every EPFO passbook
  const counted = schemes.filter((i) => i.isPublished && i.status !== 'closed');
  const groups = RETIREMENT_SCHEMES.map((s) => {
    const own = counted.filter((i) => i.type === s.value);
    let invested = own.reduce((sum, i) => sum + (i.amount || 0), 0);
    let value = own.reduce((sum, i) => sum + getCurrentInvestmentValue(i), 0);
    if (s.value === 'epf') {
      for (const a of accounts) {
        const net = (a.depositEmployeeShare || 0) - (a.withdrawEmployeeShare || 0) + (a.depositEmployerShare || 0) - (a.withdrawEmployerShare || 0) + (a.pensionContribution || 0);
        const total = a.grandTotal || 0;
        invested += Math.min(net, total);
        value += total;
      }
    }
    return { name: s.short, invested, growth: Math.max(0, value - invested), value, color: SCHEME_COLOR[s.value] };
  }).filter((g) => g.value > 0);

  return (
    <>
      {header}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <DonutPanel title="Retirement mix" subtitle="Share of current value by scheme" slices={groups} centreLabel="Corpus" />
        <BarsPanel
          title="Invested vs growth"
          subtitle="Contributions and the interest earned on them"
          rows={groups.map((g) => ({ name: g.name, invested: g.invested, growth: g.growth }))}
          series={[
            { key: 'invested', label: 'Invested', color: 'var(--c-ret)' },
            { key: 'growth', label: 'Growth', color: 'var(--color-accent)' },
          ]}
          stacked
        />
      </div>
      <div className="space-y-4">
        <SchemesTable schemes={schemes} mode={mode} setMode={setMode} />
        <ProvidentFundDetailView />
      </div>
    </>
  );
}

function SchemesTable({ schemes, mode, setMode }: { schemes: Investment[]; mode: RetMode; setMode: (m: RetMode) => void }) {
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

  return (
    <Panel flush className="overflow-hidden">
      <div className="px-6 pb-4 pt-[22px]">
        <h2 className="text-[19px]">Retirement accounts</h2>
        <p className="mt-1 text-[13px] text-muted">PPF, PF, NPS and other schemes you track by hand · tap a row to edit</p>
      </div>
      {schemes.length === 0 ? (
        <div className="px-6 pb-6">
          <EmptyState title="No retirement accounts yet" action={<Button icon={Plus} onClick={() => setMode({ kind: 'add' })}>Add retirement account</Button>}>
            Add a PPF, PF, NPS or any other retirement scheme to include it in your net worth.
          </EmptyState>
        </div>
      ) : (
        <DataTable<Investment>
          rows={schemes}
          rowKey={(i) => i.id}
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
            { key: 'scheme', label: 'Scheme', render: (i) => <Tag tone="accent">{schemeLabel(i.type)}</Tag>, sortValue: (i) => i.type },
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
            { key: 'rate', label: 'Rate', align: 'right', render: (i) => (i.interestRate != null ? `${i.interestRate}%` : '—'), sortValue: (i) => i.interestRate ?? -1 },
            { key: 'since', label: 'As of', render: (i) => fmtDate(i.startDate), sortValue: (i) => i.startDate },
            { key: 'maturity', label: 'Matures', render: (i) => (i.maturityDate ? fmtDate(i.maturityDate) : '—'), sortValue: (i) => i.maturityDate || '' },
            {
              key: 'actions',
              label: '',
              render: (i) => <RowActions label={i.name} onEdit={() => setMode({ kind: 'edit', item: i })} onDelete={() => handleDelete(i)} />,
            },
          ]}
        />
      )}
      <Drawer
        open={!!mode}
        onClose={close}
        width={640}
        title={current ? `Edit ${current.name}` : 'Add retirement account'}
        subtitle={current ? schemeLabel(current.type) : 'PPF, PF, NPS or another scheme'}
        footer={
          current ? (
            <Button variant="danger" icon={Trash2} disabled={crud.busy} onClick={() => handleDelete(current)}>
              Delete account
            </Button>
          ) : undefined
        }>
        {error && <p role="alert" className="mb-4 rounded-lg bg-loss-bg p-3 text-[13.5px] text-loss">{error}</p>}
        {mode && (
          <RetirementForm
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

  // Calculate totals
  const totalDepositEmployee = accounts.reduce((sum, acc) => sum + (acc.depositEmployeeShare || 0), 0);
  const totalDepositEmployer = accounts.reduce((sum, acc) => sum + (acc.depositEmployerShare || 0), 0);
  const totalWithdrawEmployee = accounts.reduce((sum, acc) => sum + (acc.withdrawEmployeeShare || 0), 0);
  const totalWithdrawEmployer = accounts.reduce((sum, acc) => sum + (acc.withdrawEmployerShare || 0), 0);
  const totalPension = accounts.reduce((sum, acc) => sum + (acc.pensionContribution || 0), 0);
  const totalGrandTotal = accounts.reduce((sum, acc) => sum + (acc.grandTotal || 0), 0);
  const totalAccounts = accounts.length;
  
  // Net balance (Deposits - Withdrawals)
  const netDepositEmployee = totalDepositEmployee - totalWithdrawEmployee;
  const netDepositEmployer = totalDepositEmployer - totalWithdrawEmployer;
  const netTotal = netDepositEmployee + netDepositEmployer + totalPension;

  // Establishment-wise breakdown
  const establishmentBreakdown = accounts.reduce((acc, account) => {
    const estName = account.establishmentName || 'Unknown';
    acc[estName] = (acc[estName] || 0) + (account.grandTotal || 0);
    return acc;
  }, {} as Record<string, number>);

  const establishmentChartData = Object.entries(establishmentBreakdown).map(([name, value]) => ({
    name: name.length > 20 ? name.substring(0, 20) + '...' : name,
    value,
  }));



  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <Panel flush className="overflow-hidden">
        <div className="px-6 pb-4 pt-[22px]">
          <h2 className="text-[19px]">EPF passbooks</h2>
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
                  title="Edit PPF account"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
              ),
            },
          ]}
        />
      </Panel>

      <div className="space-y-4">
        <Panel>
          <PanelHeader title="Contributions" subtitle="Deposits minus withdrawals, plus pension" />
          <DetailRow label="Employee share (net)" value={M(netDepositEmployee)} />
          <DetailRow label="Employer share (net)" value={M(netDepositEmployer)} />
          <DetailRow label="Pension contribution" value={M(totalPension)} />
          <DetailRow label="Withdrawn to date" value={M(totalWithdrawEmployee + totalWithdrawEmployer)} />
          <div className="flex items-baseline justify-between pt-4">
            <span className="text-[15px] font-semibold">Grand total</span>
            <span className="text-[19px] font-bold tabular-nums">{M(totalGrandTotal)}</span>
          </div>
          {Math.abs(netTotal - totalGrandTotal) > 1 && (
            <p className="mt-2 text-[12.5px] text-muted">Passbook grand total includes interest credited; net contributions are {M(netTotal)}.</p>
          )}
        </Panel>
        <BreakdownPanel title="By establishment" items={establishmentChartData} color="var(--c-ret)" />
      </div>

      {/* Edit PPF Account — opens in the right-side drawer */}
      <Drawer
        open={!!editingAccount}
        onClose={() => !isSaving && setEditingAccount(null)}
        title="Edit PPF account"
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
    </div>
  );
}
