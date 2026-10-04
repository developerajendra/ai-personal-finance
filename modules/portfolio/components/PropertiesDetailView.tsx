'use client';

import { useQuery } from '@tanstack/react-query';
import { Property } from '@/shared/types';
import { useState } from 'react';
import { Download, Edit2, MapPin, Plus, Trash2, Upload } from 'lucide-react';
import { Loader } from '@/shared/components/Loader';
import { Button, DetailRow, Drawer, Panel, Tag } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { ClassHeader } from './ClassPages';
import { BarsPanel, DonutPanel, SERIES_COLORS } from './ClassCharts';
import { PropertyForm } from './PropertyForm';
import { RowActions } from './RowActions';
import { usePortfolioCrud } from '../hooks/usePortfolioCrud';

const PROPERTIES_KEY = ['properties', 'all'];

const titleCase = (v: string) => v.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
const value = (p: Property) => p.currentValue || p.purchasePrice;

type Mode = { kind: 'view'; item: Property } | { kind: 'edit'; item: Property } | { kind: 'add' } | null;

/** Real estate page body: class header with "Add property", charts, properties table with full CRUD. */
export function PropertiesDetailView() {
  const [mode, setMode] = useState<Mode>(null);
  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: PROPERTIES_KEY,
    queryFn: async () => {
      const response = await fetch('/api/portfolio/properties');
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const header = <ClassHeader classKey="property" actions={<Button icon={Plus} onClick={() => setMode({ kind: 'add' })}>Add property</Button>} />;

  if (isLoading) {
    return (
      <>
        {header}
        <Loader text="Loading properties data..." size="lg" />
      </>
    );
  }

  // Charts follow net worth: published properties only
  const published = properties.filter((p) => p.isPublished);
  const byType = Object.entries(
    published.reduce((acc, p) => {
      acc[titleCase(p.type)] = (acc[titleCase(p.type)] || 0) + value(p);
      return acc;
    }, {} as Record<string, number>),
  ).map(([name, v], i) => ({ name, value: v, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
  const costVsValue = [...published]
    .sort((a, b) => value(b) - value(a))
    .map((p) => ({ name: p.name, cost: p.purchasePrice, value: value(p) }));

  return (
    <>
      {header}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <DonutPanel title="By property type" subtitle="Share of current value" slices={byType} centreLabel="Value" />
        <BarsPanel
          title="Purchase price vs current value"
          subtitle="Owner estimates of each property"
          rows={costVsValue}
          series={[
            { key: 'cost', label: 'Purchase price', color: 'var(--c-prop)' },
            { key: 'value', label: 'Current value', color: 'var(--color-accent)' },
          ]}
        />
      </div>
      <PropertiesTable properties={properties} mode={mode} setMode={setMode} />
    </>
  );
}

function PropertiesTable({ properties, mode, setMode }: { properties: Property[]; mode: Mode; setMode: (m: Mode) => void }) {
  const { M, S } = useMoney();
  const [error, setError] = useState('');
  const crud = usePortfolioCrud<Property>('properties', [PROPERTIES_KEY]);
  const appreciation = (p: Property) => value(p) - p.purchasePrice;
  const apPct = (p: Property) => (p.purchasePrice > 0 ? (appreciation(p) / p.purchasePrice) * 100 : 0);
  const statusTone = (st: Property['status']) => (st === 'owned' ? 'gain' : st === 'rented-out' ? 'accent' : 'warn');
  const drafts = properties.filter((p) => !p.isPublished).length;

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
  const handleDelete = (p: Property) => {
    if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
    attempt(() => crud.remove(p.id));
  };

  const editing = mode?.kind === 'edit' || mode?.kind === 'add';
  const current = mode && mode.kind !== 'add' ? mode.item : null;

  return (
    <Panel flush className="overflow-hidden">
      <div className="px-6 pb-4 pt-[22px]">
        <h2 className="text-[19px]">Properties</h2>
        <p className="mt-1 text-[13px] text-muted">
          {properties.length} propert{properties.length === 1 ? 'y' : 'ies'}
          {drafts > 0 && ` · ${drafts} draft${drafts === 1 ? '' : 's'}`} · current values are owner estimates · tap a row for details
        </p>
      </div>
      <DataTable<Property>
        rows={properties}
        rowKey={(p) => p.id}
        onRowClick={(item) => setMode({ kind: 'view', item })}
        defaultSort={{ key: 'value', dir: 'desc' }}
        empty="No properties yet. Use “Add property” to record one."
        columns={[
          {
            key: 'name',
            label: 'Property',
            sortValue: (p) => p.name,
            render: (p) => (
              <>
                <div className="flex items-center gap-2 font-semibold">
                  {p.name}
                  {!p.isPublished && <Tag tone="warn">Draft</Tag>}
                </div>
                <div className="flex items-center gap-1 text-[12.5px] text-muted">
                  <MapPin className="h-3 w-3" />
                  {p.location}
                </div>
              </>
            ),
          },
          { key: 'type', label: 'Type', render: (p) => titleCase(p.type), sortValue: (p) => p.type },
          { key: 'buy', label: 'Purchase price', align: 'right', render: (p) => M(p.purchasePrice), sortValue: (p) => p.purchasePrice },
          { key: 'value', label: 'Current value', align: 'right', render: (p) => <span className="font-semibold">{M(value(p))}</span>, sortValue: value },
          {
            key: 'app',
            label: 'Appreciation',
            align: 'right',
            sortValue: appreciation,
            render: (p) => (
              <span className={appreciation(p) >= 0 ? 'text-gain' : 'text-loss'}>
                {S(appreciation(p))}
                <span className="ml-1 text-[12.5px]">({apPct(p).toFixed(1)}%)</span>
              </span>
            ),
          },
          { key: 'date', label: 'Purchased', render: (p) => fmtDate(p.purchaseDate), sortValue: (p) => p.purchaseDate },
          {
            key: 'status',
            label: 'Status',
            render: (p) => (
              <Tag tone={statusTone(p.status)} className="font-semibold">
                {titleCase(p.status)}
              </Tag>
            ),
          },
          {
            key: 'actions',
            label: '',
            render: (p) => <RowActions label={p.name} onEdit={() => setMode({ kind: 'edit', item: p })} onDelete={() => handleDelete(p)} />,
          },
        ]}
      />
      <Drawer
        open={!!mode}
        onClose={close}
        width={editing ? 640 : 460}
        title={mode?.kind === 'add' ? 'Add property' : mode?.kind === 'edit' ? `Edit ${mode.item.name}` : current?.name}
        subtitle={current && !editing ? `${titleCase(current.type)} · ${current.location}${current.isPublished ? '' : ' · draft'}` : undefined}
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
          <PropertyForm
            key={current?.id ?? 'new'}
            property={current ?? undefined}
            isSaving={crud.busy}
            onCancel={close}
            onSave={(item) => attempt(() => (current ? crud.update({ ...item, id: current.id }) : crud.create(item)))}
          />
        )}
        {current && !editing && (
          <>
            <DetailRow label="Current value" value={M(value(current))} />
            <DetailRow label="Purchase price" value={M(current.purchasePrice)} />
            <DetailRow
              label="Appreciation"
              value={<span className={appreciation(current) >= 0 ? 'text-gain' : 'text-loss'}>{S(appreciation(current))} ({apPct(current).toFixed(1)}%)</span>}
            />
            <DetailRow label="Purchased" value={fmtDate(current.purchaseDate)} />
            <DetailRow label="Asset type" value={current.assetType === 'liquid' ? 'Liquid' : 'Fixed'} />
            <DetailRow label="Status" value={<Tag tone={statusTone(current.status)}>{titleCase(current.status)}</Tag>} />
            <DetailRow label="Visibility" value={current.isPublished ? 'Published · counts toward net worth' : <Tag tone="warn">Draft · not in net worth</Tag>} />
            {current.description && <p className="mt-4 text-[14px] text-muted">{current.description}</p>}
          </>
        )}
      </Drawer>
    </Panel>
  );
}
