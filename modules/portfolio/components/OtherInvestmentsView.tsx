'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Investment } from '@/shared/types';
import { Download, Edit2, Plus, Trash2, Upload } from 'lucide-react';
import { Loader } from '@/shared/components/Loader';
import { Button, DetailRow, Drawer, Panel, Tag } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { daysUntil, isRetirementInvestment } from '@/shared/hooks/usePortfolioTotals';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';
import { ClassHeader } from './ClassPages';
import { BarsPanel, DonutPanel, toSlices } from './ClassCharts';
import { InvestmentForm } from './InvestmentForm';
import { RowActions } from './RowActions';
import { usePortfolioCrud } from '../hooks/usePortfolioCrud';

const INVESTMENTS_KEY = ['investments', 'all'];

const TYPE_LABELS: Record<string, string> = {
  ppf: 'PPF',
  fd: 'Fixed deposit',
  'mutual-fund': 'Mutual fund',
  stocks: 'Stocks',
  bonds: 'Bonds',
  other: 'Other',
};
const typeLabel = (i: Investment) => TYPE_LABELS[i.type] ?? i.type;
/** Manually entered stocks and funds roll up into Stocks & funds, not this class's total. */
const isMarket = (i: Investment) => i.type === 'stocks' || i.type === 'mutual-fund';
const statusTone = (st: Investment['status']) => (st === 'active' ? 'gain' : st === 'matured' ? 'accent' : 'neutral');
const statusLabel = (st: Investment['status']) => st.charAt(0).toUpperCase() + st.slice(1);

type Mode = { kind: 'view'; item: Investment } | { kind: 'edit'; item: Investment } | { kind: 'add' } | null;

/**
 * Other investments page: every manually tracked investment that isn't a retirement account —
 * deposits, bonds, PPF, gold, manually entered stocks / funds, anything else. Charts, then the
 * full list with add / edit / delete / publish.
 */
export function OtherInvestmentsView() {
  const [mode, setMode] = useState<Mode>(null);
  const { data: investments = [], isLoading } = useQuery<Investment[]>({
    queryKey: INVESTMENTS_KEY,
    queryFn: async () => {
      const response = await fetch('/api/portfolio/investments');
      if (!response.ok) throw new Error('Failed to fetch investments');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const header = <ClassHeader classKey="investments" actions={<Button icon={Plus} onClick={() => setMode({ kind: 'add' })}>Add investment</Button>} />;

  if (isLoading) {
    return (
      <>
        {header}
        <Loader text="Loading investments..." size="lg" />
      </>
    );
  }

  // Retirement accounts (NPS, PF…) are managed on the Retirement page
  const rows = investments.filter((i) => !isRetirementInvestment(i));
  // Charts follow this class's net-worth total: published, not closed, not stocks / funds
  const counted = rows.filter((i) => i.isPublished && i.status !== 'closed' && !isMarket(i));
  const byType = toSlices(counted.map((i) => ({ name: typeLabel(i), value: getCurrentInvestmentValue(i) })));
  const growth = [...counted]
    .map((i) => ({ name: i.name, invested: i.amount || 0, value: getCurrentInvestmentValue(i) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((g) => ({ name: g.name, invested: Math.min(g.invested, g.value), growth: Math.max(0, g.value - g.invested) }));

  return (
    <>
      {header}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <DonutPanel title="By type" subtitle="Share of current value" slices={byType} centreLabel="Value" />
        <BarsPanel
          title="Invested vs growth"
          subtitle={counted.length > growth.length ? `Largest ${growth.length} of ${counted.length} investments` : 'Amount put in and the interest or returns earned on it'}
          rows={growth}
          series={[
            { key: 'invested', label: 'Invested', color: 'var(--c-ret)' },
            { key: 'growth', label: 'Growth', color: 'var(--color-accent)' },
          ]}
          stacked
        />
      </div>
      <InvestmentsTable investments={rows} mode={mode} setMode={setMode} />
    </>
  );
}

function InvestmentsTable({ investments, mode, setMode }: { investments: Investment[]; mode: Mode; setMode: (m: Mode) => void }) {
  const { M, S } = useMoney();
  const [error, setError] = useState('');
  const crud = usePortfolioCrud<Investment>('investments', [INVESTMENTS_KEY]);
  const drafts = investments.filter((i) => !i.isPublished).length;

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

  const editing = mode?.kind === 'edit' || mode?.kind === 'add';
  const current = mode && mode.kind !== 'add' ? mode.item : null;
  const gain = (i: Investment) => getCurrentInvestmentValue(i) - (i.amount || 0);

  return (
    <Panel flush className="overflow-hidden">
      <div className="px-6 pb-4 pt-[22px]">
        <h2 className="text-[19px]">Investments</h2>
        <p className="mt-1 text-[13px] text-muted">
          {investments.length} investment{investments.length === 1 ? '' : 's'}
          {drafts > 0 && ` · ${drafts} draft${drafts === 1 ? '' : 's'}`} · values follow each record’s growth rule · tap a row for details
        </p>
      </div>
      <DataTable<Investment>
        rows={investments}
        rowKey={(i) => i.id}
        onRowClick={(item) => setMode({ kind: 'view', item })}
        defaultSort={{ key: 'value', dir: 'desc' }}
        empty="No investments yet. Use “Add investment” to record a deposit, bond, gold or anything else."
        columns={[
          {
            key: 'name',
            label: 'Investment',
            sortValue: (i) => i.name,
            render: (i) => (
              <>
                <div className="flex items-center gap-2 font-semibold">
                  {i.name}
                  {!i.isPublished && <Tag tone="warn">Draft</Tag>}
                </div>
                <div className="text-[12.5px] text-muted">
                  {typeLabel(i)}
                  {isMarket(i) && ' · counted in Stocks & funds'}
                </div>
              </>
            ),
          },
          { key: 'invested', label: 'Invested', align: 'right', render: (i) => M(i.amount), sortValue: (i) => i.amount },
          {
            key: 'value',
            label: 'Current value',
            align: 'right',
            sortValue: getCurrentInvestmentValue,
            render: (i) => (
              <>
                <div className="font-semibold">{M(getCurrentInvestmentValue(i))}</div>
                {Math.abs(gain(i)) > 0.5 && <div className={`text-[12.5px] ${gain(i) >= 0 ? 'text-gain' : 'text-loss'}`}>{S(gain(i))}</div>}
              </>
            ),
          },
          { key: 'rate', label: 'Rate', align: 'right', render: (i) => (i.interestRate != null ? `${i.interestRate}%` : '—'), sortValue: (i) => i.interestRate ?? -1 },
          { key: 'start', label: 'Started', render: (i) => fmtDate(i.startDate), sortValue: (i) => i.startDate },
          {
            key: 'maturity',
            label: 'Matures',
            sortValue: (i) => i.maturityDate || '9999',
            render: (i) => {
              if (!i.maturityDate) return <span className="text-muted">—</span>;
              const d = daysUntil(i.maturityDate);
              return (
                <>
                  <div>{fmtDate(i.maturityDate)}</div>
                  {d != null && d >= 0 && d <= 90 && <div className="text-[12.5px] text-warn">in {d} days</div>}
                </>
              );
            },
          },
          {
            key: 'status',
            label: 'Status',
            sortValue: (i) => i.status,
            render: (i) => (
              <Tag tone={statusTone(i.status)} className="font-semibold">
                {statusLabel(i.status)}
              </Tag>
            ),
          },
          {
            key: 'actions',
            label: '',
            render: (i) => <RowActions label={i.name} onEdit={() => setMode({ kind: 'edit', item: i })} onDelete={() => handleDelete(i)} />,
          },
        ]}
      />
      <Drawer
        open={!!mode}
        onClose={close}
        width={editing ? 640 : 460}
        title={mode?.kind === 'add' ? 'Add investment' : mode?.kind === 'edit' ? `Edit ${mode.item.name}` : current?.name}
        subtitle={current && !editing ? `${typeLabel(current)}${current.isPublished ? '' : ' · draft'}` : undefined}
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
          <InvestmentForm
            key={current?.id ?? 'new'}
            investment={current ?? undefined}
            isSaving={crud.busy}
            onCancel={close}
            // Records added here count toward net worth straight away; drafts come from imports
            onSave={(item) => attempt(() => (current ? crud.update({ ...item, id: current.id }) : crud.create({ ...item, isPublished: true })))}
          />
        )}
        {current && !editing && (
          <>
            <DetailRow label="Current value" value={M(getCurrentInvestmentValue(current), 2)} />
            <DetailRow label="Invested" value={M(current.amount)} />
            <DetailRow label="Gain" value={<span className={gain(current) >= 0 ? 'text-gain' : 'text-loss'}>{S(gain(current))}</span>} />
            {current.interestRate != null && <DetailRow label="Rate" value={`${current.interestRate}% p.a.`} />}
            {current.ruleLabel && <DetailRow label="Growth rule" value={current.ruleLabel} />}
            <DetailRow label="Started" value={fmtDate(current.startDate)} />
            {current.maturityDate && <DetailRow label="Matures" value={fmtDate(current.maturityDate)} />}
            {current.maturityAmount != null && <DetailRow label="Maturity amount" value={M(current.maturityAmount)} />}
            <DetailRow label="Asset type" value={current.assetType === 'fixed' ? 'Fixed' : 'Liquid'} />
            <DetailRow label="Status" value={<Tag tone={statusTone(current.status)}>{statusLabel(current.status)}</Tag>} />
            <DetailRow
              label="Visibility"
              value={current.isPublished ? (isMarket(current) ? 'Published · counted in Stocks & funds' : 'Published · counts toward net worth') : <Tag tone="warn">Draft · not in net worth</Tag>}
            />
            {current.description && <p className="mt-4 text-[14px] text-muted">{current.description}</p>}
          </>
        )}
      </Drawer>
    </Panel>
  );
}
