'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Panel, PanelHeader, StatusDot } from '@/shared/components/ui';

/** Imports → Connections: Zerodha and Google Drive. */
export function ConnectionsPanel() {
  const [isConnecting, setIsConnecting] = useState(false);
  // Same key + request as the Portfolio page, so this reuses its cache
  const { data: stocks } = useQuery<{ stocks: any[]; isAuthenticated?: boolean; message?: string }>({
    queryKey: ['stocks'],
    queryFn: async () => {
      const response = await fetch('/api/zerodha/stocks');
      if (!response.ok) return { stocks: [] };
      return response.json();
    },
  });

  const connectZerodha = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/zerodha/login');
      const { loginUrl } = await response.json();
      if (loginUrl) window.location.href = loginUrl;
      else setIsConnecting(false);
    } catch (error) {
      console.error('Error connecting to Zerodha:', error);
      setIsConnecting(false);
    }
  };

  return (
    <Panel>
      <PanelHeader title="Connections" />
      <div className="border-b border-divider pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-semibold">Zerodha</h3>
            <p className="mt-1 text-[13.5px] text-muted">Stocks and mutual fund holdings.</p>
          </div>
          {stocks?.isAuthenticated ? <StatusDot tone="gain">Connected</StatusDot> : <StatusDot tone="warn">Not authenticated</StatusDot>}
        </div>
        {!stocks?.isAuthenticated && (
          <button onClick={connectZerodha} disabled={isConnecting} className="btn btn-ghost btn-sm mt-3 !px-1.5">
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>
      <div className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-semibold">Google Drive</h3>
            <p className="mt-1 text-[13.5px] text-muted">Paste a share link (Source → Drive link) to import a spreadsheet.</p>
          </div>
          <StatusDot>Link import only</StatusDot>
        </div>
      </div>
    </Panel>
  );
}
