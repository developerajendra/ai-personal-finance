'use client';

import { useQuery } from '@tanstack/react-query';
import { Property } from '@/shared/types';
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Loader } from '@/shared/components/Loader';
import { DetailRow, Drawer, Panel, Tag } from '@/shared/components/ui';
import { DataTable } from '@/shared/components/DataTable';
import { useMoney, fmtDate } from '@/shared/hooks/useMoney';
import { BreakdownPanel } from './BreakdownPanel';

export function PropertiesDetailView() {
  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ['properties', 'published'],
    queryFn: async () => {
      const response = await fetch('/api/portfolio/properties?isPublished=true');
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Loader text="Loading properties data..." size="lg" />
      </div>
    );
  }


  const propertyTypeBreakdown = properties.reduce((acc, prop) => {
    const typeName = prop.type.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    acc[typeName] = (acc[typeName] || 0) + (prop.currentValue || prop.purchasePrice);
    return acc;
  }, {} as Record<string, number>);

  const propertyChartData = Object.entries(propertyTypeBreakdown).map(([name, value]) => ({
    name,
    value,
  }));


  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <PropertiesTable properties={properties} />
      <BreakdownPanel title="By property type" items={propertyChartData} color="var(--c-prop)" />
    </div>
  );
}

const titleCase = (v: string) => v.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

function PropertiesTable({ properties }: { properties: Property[] }) {
  const { M, S } = useMoney();
  const [open, setOpen] = useState<Property | null>(null);
  const value = (p: Property) => p.currentValue || p.purchasePrice;
  const appreciation = (p: Property) => value(p) - p.purchasePrice;
  const apPct = (p: Property) => (p.purchasePrice > 0 ? (appreciation(p) / p.purchasePrice) * 100 : 0);
  const statusTone = (st: Property['status']) => (st === 'owned' ? 'gain' : st === 'rented-out' ? 'accent' : 'warn');

  return (
    <Panel flush className="overflow-hidden">
      <div className="px-6 pb-4 pt-[22px]">
        <h2 className="text-[19px]">Properties</h2>
        <p className="mt-1 text-[13px] text-muted">Current values are owner estimates · tap a row for details</p>
      </div>
      <DataTable<Property>
        rows={properties}
        rowKey={(p) => p.id}
        onRowClick={setOpen}
        defaultSort={{ key: 'value', dir: 'desc' }}
        empty="No properties data available. Add properties in the Portfolio section."
        columns={[
          {
            key: 'name',
            label: 'Property',
            sortValue: (p) => p.name,
            render: (p) => (
              <>
                <div className="font-semibold">{p.name}</div>
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
        ]}
      />
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.name} subtitle={open ? `${titleCase(open.type)} · ${open.location}` : undefined}>
        {open && (
          <>
            <DetailRow label="Current value" value={M(value(open))} />
            <DetailRow label="Purchase price" value={M(open.purchasePrice)} />
            <DetailRow label="Appreciation" value={<span className={appreciation(open) >= 0 ? 'text-gain' : 'text-loss'}>{S(appreciation(open))} ({apPct(open).toFixed(1)}%)</span>} />
            <DetailRow label="Purchased" value={fmtDate(open.purchaseDate)} />
            <DetailRow label="Asset type" value={open.assetType === 'liquid' ? 'Liquid' : 'Fixed'} />
            <DetailRow label="Status" value={<Tag tone={statusTone(open.status)}>{titleCase(open.status)}</Tag>} />
            {open.description && <p className="mt-4 text-[14px] text-muted">{open.description}</p>}
            <p className="mt-6 text-[13px] text-muted">Edit or publish properties from the Portfolio overview → Properties tab.</p>
          </>
        )}
      </Drawer>
    </Panel>
  );
}
