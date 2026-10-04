'use client';

import { useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

type Resource = 'bank-balances' | 'properties' | 'investments' | 'loans';
const PUBLISH_TYPE: Record<Resource, string> = {
  'bank-balances': 'bank-balance',
  properties: 'property',
  investments: 'investment',
  loans: 'loan',
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/**
 * Create / update / delete / publish for one portfolio resource. Every write refreshes
 * the shared portfolio snapshot (headers, sidebar, dashboard) plus the given list queries.
 */
export function usePortfolioCrud<T extends { id: string }>(resource: Resource, listKeys: QueryKey[]) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const base = `/api/portfolio/${resource}`;

  const run = async <R,>(fn: () => Promise<R>): Promise<R> => {
    setBusy(true);
    try {
      const out = await fn();
      await Promise.all(
        [['portfolio-snapshot'] as QueryKey, ...listKeys].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      return out;
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    create: (item: T) => run(() => send(base, 'POST', { ...item, isPublished: true })),
    update: (item: T) => run(() => send(`${base}/${item.id}`, 'PUT', item)),
    remove: (id: string) => run(() => send(`${base}/${id}`, 'DELETE')),
    setPublished: (id: string, isPublished: boolean) =>
      run(() => send('/api/portfolio/publish', 'POST', { type: PUBLISH_TYPE[resource], id, isPublished })),
  };
}
