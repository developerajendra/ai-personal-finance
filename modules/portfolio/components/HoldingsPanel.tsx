'use client';

import { useState, type ReactNode } from 'react';
import { RefreshCw, Link as LinkIcon, LogOut } from 'lucide-react';
import { Button, DetailRow, Drawer, Panel, StatusDot } from '@/shared/components/ui';
import { DataTable, type Column } from '@/shared/components/DataTable';

/**
 * Zerodha holdings panel shared by Stocks and Mutual funds: connection status,
 * refresh/connect actions, a sortable table and a detail drawer on row click.
 */
export function HoldingsPanel<T>({
  title,
  isAuthenticated,
  message,
  isConnecting,
  isRefreshing,
  onConnect,
  onDisconnect,
  onRefresh,
  columns,
  rows,
  rowKey,
  empty,
  detail,
}: {
  title: string;
  isAuthenticated: boolean;
  message?: string;
  isConnecting: boolean;
  isRefreshing: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  empty: ReactNode;
  detail: (r: T) => { title: ReactNode; subtitle?: ReactNode; rows: [ReactNode, ReactNode][] };
}) {
  const [open, setOpen] = useState<T | null>(null);
  const d = open ? detail(open) : null;

  return (
    <Panel flush className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-[22px]">
        <div>
          <h2 className="text-[19px]">{title}</h2>
          <div className="mt-1">
            {isAuthenticated ? (
              <StatusDot tone="gain">Connected to Zerodha</StatusDot>
            ) : (
              <StatusDot tone="warn">{message || 'Not connected to Zerodha · showing cached data'}</StatusDot>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAuthenticated ? (
            <Button variant="secondary" icon={LogOut} onClick={onDisconnect}>
              Disconnect
            </Button>
          ) : (
            <Button variant="secondary" icon={LinkIcon} onClick={onConnect} disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect Zerodha'}
            </Button>
          )}
          <Button onClick={onRefresh} disabled={isRefreshing} icon={RefreshCw} className={isRefreshing ? '[&>svg]:animate-spin' : undefined}>
            Refresh
          </Button>
        </div>
      </div>
      <DataTable columns={columns} rows={rows} rowKey={rowKey} onRowClick={setOpen} empty={empty} defaultSort={{ key: 'value', dir: 'desc' }} />
      <Drawer open={!!open} onClose={() => setOpen(null)} title={d?.title} subtitle={d?.subtitle}>
        {d?.rows.map(([k, v], i) => <DetailRow key={i} label={k} value={v} />)}
      </Drawer>
    </Panel>
  );
}
