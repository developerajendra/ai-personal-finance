'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { FinancialSnapshot } from '@/shared/types';

async function getJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Month-end financial snapshots from /api/archive (the same store the Archive screen uses).
 * Returns monthly snapshots oldest → newest, plus yearly snapshots for years kept only as yearly.
 */
export function useSnapshots() {
  const { data: yearsData, isLoading: yearsLoading } = useQuery<{ years: number[] } | null>({
    queryKey: ['archive-years'],
    queryFn: () => getJSON('/api/archive?action=years'),
  });
  const years = useMemo(() => [...(yearsData?.years ?? [])].sort((a, b) => a - b), [yearsData]);

  const results = useQueries({
    queries: years.map((y) => ({
      queryKey: ['archive-year', y],
      queryFn: () => getJSON(`/api/archive?year=${y}`) as Promise<{ snapshots?: FinancialSnapshot[]; snapshot?: FinancialSnapshot } | null>,
    })),
  });

  const isLoading = yearsLoading || results.some((r) => r.isLoading);

  const { monthly, yearly } = useMemo(() => {
    const monthly: FinancialSnapshot[] = [];
    const yearly: FinancialSnapshot[] = [];
    for (const r of results) {
      const d = r.data;
      if (!d) continue;
      if (d.snapshots) {
        for (const s of d.snapshots) (s.month ? monthly : yearly).push(s);
      } else if (d.snapshot) {
        (d.snapshot.month ? monthly : yearly).push(d.snapshot);
      }
    }
    const order = (s: FinancialSnapshot) => s.year * 100 + (s.month ?? 12);
    monthly.sort((a, b) => order(a) - order(b));
    yearly.sort((a, b) => order(a) - order(b));
    return { monthly, yearly };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(',')]);

  return { monthly, yearly, years, isLoading };
}

export { snapshotClasses } from '@/shared/utils/netWorthHistory';
