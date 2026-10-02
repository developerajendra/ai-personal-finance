'use client';

import { useQuery } from '@tanstack/react-query';
import { BankBalance } from '@/shared/types';
import { useState } from 'react';
import { Loader } from '@/shared/components/Loader';
import { DetailRow, Drawer, Panel, Tag } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { BreakdownPanel } from './BreakdownPanel';

export function BankBalancesDetailView() {
  const { data: bankBalances = [], isLoading } = useQuery<BankBalance[]>({
    queryKey: ['bankBalances', 'published'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/bank-balances?isPublished=true');
      if (!response.ok) throw new Error('Failed to fetch bank balances');
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading bank balances data..." size="lg" />
      </div>
    );
  }

  // Filter out receivables - they should only appear in the receivables page
  const bankBalancesOnly = bankBalances.filter((balance) => !balance.tags?.includes('receivable'));

  const activeAccounts = bankBalancesOnly.filter((balance) => balance.status === 'active').length;

  const bankBreakdown = bankBalancesOnly.reduce((acc, balance) => {
    acc[balance.bankName] = (acc[balance.bankName] || 0) + balance.balance;
    return acc;
  }, {} as Record<string, number>);

  const bankChartData = Object.entries(bankBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  const accountTypeBreakdown = bankBalancesOnly.reduce((acc, balance) => {
    const typeName = balance.accountType.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    acc[typeName] = (acc[typeName] || 0) + balance.balance;
    return acc;
  }, {} as Record<string, number>);

  const accountTypeChartData = Object.entries(accountTypeBreakdown).map(([name, value]) => ({
    name,
    value,
  }));


  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <BankAccountsTable balances={bankBalancesOnly} activeAccounts={activeAccounts} />
      <div className="space-y-4">
        <BreakdownPanel title="By bank" items={bankChartData} color="var(--c-cash)" />
        <BreakdownPanel title="By account type" items={accountTypeChartData} color="var(--color-accent)" />
      </div>
    </div>
  );
}

function BankAccountsTable({ balances, activeAccounts }: { balances: BankBalance[]; activeAccounts: number }) {
  const { M, O } = useMoney();
  const [open, setOpen] = useState<BankBalance | null>(null);
  const ccy = (b: BankBalance) => b.originalCurrency || b.currency || 'INR';
  const typeName = (b: BankBalance) => b.accountType.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const statusTone = (st: BankBalance['status']) => (st === 'active' ? 'gain' : st === 'closed' ? 'neutral' : 'warn');

  return (
    <Panel flush className="overflow-hidden">
      <div className="px-6 pb-4 pt-[22px]">
        <h2 className="text-[19px]">Accounts</h2>
        <p className="mt-1 text-[13px] text-muted">
          {balances.length} accounts · {activeAccounts} active · tap a row for details
        </p>
      </div>
      <DataTable<BankBalance>
        rows={balances}
        rowKey={(b) => b.id}
        onRowClick={setOpen}
        defaultSort={{ key: 'balance', dir: 'desc' }}
        empty="No bank balances data available. Add bank accounts in the Portfolio section."
        columns={[
          {
            key: 'bank',
            label: 'Bank',
            sortValue: (b) => b.bankName,
            render: (b) => (
              <>
                <div className="font-semibold">{b.bankName}</div>
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
        ]}
      />
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.bankName} subtitle={open ? `${typeName(open)} account` : undefined}>
        {open && (
          <>
            <DetailRow label="Balance" value={M(open.balance, 2)} />
            {ccy(open) !== 'INR' && <DetailRow label="Original amount" value={O(open.originalAmount ?? open.balance, ccy(open))} />}
            <DetailRow label="Currency" value={ccy(open)} />
            {open.accountNumber && <DetailRow label="Account" value={`••${open.accountNumber.slice(-4)}`} />}
            <DetailRow label="Asset type" value={open.assetType === 'fixed' ? 'Fixed' : 'Liquid'} />
            <DetailRow label="Last updated" value={fmtDate(open.lastUpdated)} />
            <DetailRow label="Status" value={<Tag tone={statusTone(open.status)}>{open.status}</Tag>} />
            {open.description && <p className="mt-4 text-[14px] text-muted">{open.description}</p>}
            <p className="mt-6 text-[13px] text-muted">Edit or publish accounts from the Portfolio overview → Bank balances tab.</p>
          </>
        )}
      </Drawer>
    </Panel>
  );
}
