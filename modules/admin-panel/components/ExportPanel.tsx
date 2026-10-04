'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Panel, PanelHeader } from '@/shared/components/ui';

const SHEETS = [
  'Summary: net worth, asset classes, investment and loan breakdowns',
  'Your categories',
  'Investments, fixed deposits and retirement records',
  'Bank balances and receivables',
  'Loans and their EMI history',
  'Properties',
  'Stocks, mutual funds and provident fund',
  'Transactions, budget and subscriptions',
  'Net worth history',
];

/** Imports → Export: the one place to download everything as a single Excel workbook. */
export function ExportPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/portfolio/export');
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Export failed');
      const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'portfolio-export.xlsx';
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader title="Export" subtitle="Download all your data as one Excel workbook (.xlsx)." />
      <ul className="space-y-1.5 text-[13.5px] text-muted">
        {SHEETS.map((s) => (
          <li key={s} className="flex gap-2">
            <span aria-hidden>·</span>
            {s}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-muted">Drafts are included in the record sheets. The workbook can be imported back here.</p>
      <button onClick={download} disabled={busy} className="btn btn-primary mt-4 w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? 'Preparing export…' : 'Export to Excel'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-loss">
          {error}
        </p>
      )}
    </Panel>
  );
}
