'use client';

import { useEffect, useState } from 'react';
import { Segmented } from '@/shared/components/ui';

export type DraftView = 'published' | 'draft';

/**
 * Draft / Published split for a manually maintained list (same idea as Receivables).
 * Opens on Draft when there is something to review, and falls back to Published once
 * the last draft is published or deleted.
 */
export function useDraftView<T extends { isPublished?: boolean }>(rows: T[]) {
  const drafts = rows.filter((r) => !r.isPublished);
  const published = rows.filter((r) => r.isPublished);
  const [view, setView] = useState<DraftView>(drafts.length ? 'draft' : 'published');

  useEffect(() => {
    if (view === 'draft' && drafts.length === 0) setView('published');
  }, [view, drafts.length]);

  return { view, setView, visible: view === 'draft' ? drafts : published, drafts: drafts.length, published: published.length };
}

const Count = ({ n }: { n: number }) => (
  <span className="ml-1.5 inline-flex min-w-[20px] items-center justify-center rounded-full bg-tile px-1.5 text-[11.5px] font-semibold leading-5 text-ink">{n}</span>
);

export function DraftTabs({ view, setView, drafts, published }: { view: DraftView; setView: (v: DraftView) => void; drafts: number; published: number }) {
  return (
    <Segmented<DraftView>
      value={view}
      onChange={setView}
      ariaLabel="Draft or published"
      options={[
        { value: 'published', label: <>Published<Count n={published} /></> },
        { value: 'draft', label: <>Draft<Count n={drafts} /></> },
      ]}
    />
  );
}
