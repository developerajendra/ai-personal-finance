'use client';

import { useMemo } from 'react';
import type { FinancialSnapshot } from '@/shared/types';
import type { usePortfolioTotals } from '@/shared/hooks/usePortfolioTotals';
import { receivableExpected } from '@/shared/utils/receivables';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';
import { buildHistory, compare, coverageChanges, liveObservation, type ClassValues, type RangeKey } from '@/shared/utils/netWorthHistory';

type Totals = ReturnType<typeof usePortfolioTotals>;

/**
 * Today's net worth, the saved history and the comparison for one period — shared by the dashboard
 * Net worth card and Performance so both show the same opening, closing and change.
 */
export function useNetWorthPeriod(t: Totals, snapshots: { monthly: FinancialSnapshot[]; yearly: FinancialSnapshot[]; isLoading: boolean }, range: RangeKey) {
  const { monthly, yearly, isLoading: snapsLoading } = snapshots;
  // One clock per data load so every figure refers to the same moment
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [t.isLoading, snapsLoading]);

  // The Portfolio's own class values (usePortfolioTotals), plus outstanding loans
  const classes: ClassValues = useMemo(
    () => ({
      bank: t.byKey.bank.value,
      stocks: t.byKey.stocks.value,
      pf: t.byKey.pf.value,
      property: t.byKey.property.value,
      recv: t.byKey.recv.value,
      fd: t.byKey.fd.value,
      investments: t.byKey.investments.value,
      loans: t.liabilities,
    }),
    [t.byKey, t.liabilities],
  );
  // The balance sheet's own figures, so the card, Balance sheet panel and Performance always agree
  const live = useMemo(
    () => ({ ...liveObservation(classes, now), netWorth: t.netWorth, assets: t.assets, liabilities: t.liabilities }),
    [classes, now, t.netWorth, t.assets, t.liabilities],
  );

  const history = useMemo(() => buildHistory([...yearly, ...monthly], now), [monthly, yearly, now]);
  const cmp = useMemo(() => compare(history.observations, live, range, now), [history, live, range, now]);
  const opening = cmp.status === 'ok' ? cmp.opening : undefined;

  const coverage = useMemo(
    () =>
      opening
        ? coverageChanges(opening, live, {
            investments: t.investments,
            loans: t.activeLoans,
            properties: t.properties,
            receivables: t.receivables,
            ppfAccounts: t.ppfAccounts,
            investmentValue: getCurrentInvestmentValue,
            receivableValue: (r) => receivableExpected(r).total,
          })
        : [],
    [opening, live, t.investments, t.activeLoans, t.properties, t.receivables, t.ppfAccounts],
  );

  return { now, live, history, cmp, opening, coverage, isLoading: t.isLoading || snapsLoading };
}
