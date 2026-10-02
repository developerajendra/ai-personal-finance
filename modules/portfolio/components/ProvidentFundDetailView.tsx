'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PPFAccount } from "@/shared/types";
import { Edit2 } from 'lucide-react';
import { DetailRow, Drawer, EmptyState, LinkButton, Panel, PanelHeader } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney } from '@/shared/hooks/useMoney';
import { BreakdownPanel } from './BreakdownPanel';
import { Loader } from '@/shared/components/Loader';
import { ProvidentFundEditForm } from './ProvidentFundEditForm';
import { format } from 'date-fns';


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
    refetchOnMount: true,
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
      await queryClient.invalidateQueries({ queryKey: ['ppfAccounts'] });
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
        <Loader text="Loading PPF account data..." size="lg" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="No PPF accounts found"
          action={<LinkButton href="/data/upload">Go to imports</LinkButton>}
        >
          Upload EPFO passbook PDFs from Imports &amp; data (import type: Provident fund) to get started.
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
          <h2 className="text-[19px]">EPF accounts</h2>
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
