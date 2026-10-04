/**
 * Client-side analytics for the Overview screen, computed from the same data the
 * app already loads (portfolio snapshot + transactions). No new API calls.
 */
import type { BankBalance, Investment, Loan, Transaction } from '@/shared/types';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';

export interface MonthFlow {
  key: string; // yyyy-mm
  income: number;
  expenses: number;
}

/** Income / expense totals per calendar month, newest first. */
export function monthlyFlows(transactions: Transaction[]): MonthFlow[] {
  const map = new Map<string, MonthFlow>();
  for (const t of transactions) {
    const key = (t.date || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    const m = map.get(key) ?? { key, income: 0, expenses: 0 };
    if (t.type === 'credit') m.income += Math.abs(t.amount);
    else m.expenses += Math.abs(t.amount);
    map.set(key, m);
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** Most recent complete month with data (falls back to the current month). */
export function referenceMonth(flows: MonthFlow[]): MonthFlow | null {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return flows.find((f) => f.key < current && (f.expenses > 0 || f.income > 0)) ?? flows[0] ?? null;
}

export function monthName(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleString('en-GB', { month: 'long' });
}

const daysTo = (iso?: string) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : (t - Date.now()) / 864e5;
};

export interface LadderRung {
  key: string;
  label: string;
  note: string;
  value: number;
  color: string;
}

/** Group every asset by how quickly it can become cash. */
export function liquidityLadder(input: {
  cashAccounts: BankBalance[];
  deposits: Investment[];
  marketValue: number;
  retirement: number;
  property: number;
  receivables: number;
}): LadderRung[] {
  let today = 0;
  let lockedCash = 0;
  for (const b of input.cashAccounts) {
    if (b.assetType === 'fixed' || b.accountType === 'fd' || b.accountType === 'rd') lockedCash += b.balance || 0;
    else today += b.balance || 0;
  }
  let d90 = 0;
  let d365 = 0;
  let y5 = 0;
  let locked = lockedCash;
  for (const inv of input.deposits) {
    const v = getCurrentInvestmentValue(inv);
    const d = daysTo(inv.maturityDate);
    if (d == null) {
      if (inv.assetType === 'liquid') y5 += v;
      else locked += v;
    } else if (d <= 90) d90 += v;
    else if (d <= 365) d365 += v;
    else if (d <= 365 * 5 && inv.assetType !== 'fixed') y5 += v;
    else locked += v;
  }
  return [
    { key: 'today', label: 'Available today', note: 'Bank balances', value: today, color: 'var(--lad-1)' },
    { key: 'week', label: 'Within a week', note: 'Listed stocks, open-ended funds (T+1 to T+3)', value: input.marketValue, color: 'var(--lad-2)' },
    { key: '90d', label: 'Within 90 days', note: 'Deposits maturing + matured payouts pending', value: d90, color: 'var(--lad-3)' },
    { key: 'year', label: 'Within a year', note: 'Deposits maturing in the next 12 months', value: d365, color: 'var(--lad-4)' },
    { key: '5y', label: '1–5 years', note: 'Term deposits and bonds · breakable at a cost', value: y5, color: 'var(--lad-5)' },
    { key: 'locked', label: 'Locked or illiquid', note: 'Long deposits, EPF/PPF, real estate', value: locked + input.retirement + input.property, color: 'var(--lad-6)' },
    { key: 'uncertain', label: 'Uncertain', note: 'Depends on debtors repaying', value: input.receivables, color: 'var(--lad-7)' },
  ];
}

export type HealthTone = 'gain' | 'warn' | 'loss' | 'neutral';
export interface HealthCheck {
  key: string;
  label: string;
  value: string;
  verdict: string;
  tone: HealthTone;
  note: string;
  healthy: boolean;
}

export function healthChecks(input: {
  cash: number;
  assets: number;
  netWorth: number;
  liabilities: number;
  market: number;
  property: number;
  receivables: number;
  loans: Loan[];
  ref: MonthFlow | null;
  largest: { label: string; value: number } | null;
}): HealthCheck[] {
  const { cash, assets, netWorth, liabilities, market, property, receivables, loans, ref, largest } = input;
  const emi = loans.filter((l) => l.status === 'active').reduce((s, l) => s + (l.emiAmount || 0), 0);
  const financial = assets - property - receivables;
  const month = ref ? monthName(ref.key) : null;
  const out: HealthCheck[] = [];

  if (ref && ref.expenses > 0) {
    const months = cash / ref.expenses;
    out.push({
      key: 'emergency',
      label: 'Emergency cover',
      value: `${months.toFixed(1)} months`,
      verdict: months >= 6 ? 'Healthy' : months >= 3 ? 'Below 6-month target' : 'Low',
      tone: months >= 6 ? 'gain' : months >= 3 ? 'warn' : 'loss',
      note: `Cash ÷ ${month} spending (EMI included).`,
      healthy: months >= 6,
    });
  }
  if (assets > 0) {
    const r = (liabilities / assets) * 100;
    out.push({
      key: 'debt',
      label: 'Debt to assets',
      value: `${r.toFixed(1)}%`,
      verdict: r < 30 ? 'Healthy' : r < 50 ? 'Elevated' : 'High',
      tone: r < 30 ? 'gain' : r < 50 ? 'warn' : 'loss',
      note: 'Loans ÷ total assets. Under 30% is comfortable.',
      healthy: r < 30,
    });
  }
  if (ref && ref.income > 0 && emi > 0) {
    const r = (emi / ref.income) * 100;
    out.push({
      key: 'emi',
      label: 'EMI to income',
      value: `${r.toFixed(1)}%`,
      verdict: r < 30 ? 'Healthy' : r < 45 ? 'Stretched' : 'High',
      tone: r < 30 ? 'gain' : r < 45 ? 'warn' : 'loss',
      note: `Monthly EMI ÷ ${month} income. Lenders cap near 40–50%.`,
      healthy: r < 30,
    });
  }
  if (ref && ref.income > 0) {
    const r = ((ref.income - ref.expenses) / ref.income) * 100;
    out.push({
      key: 'savings',
      label: 'Savings rate',
      value: `${r.toFixed(0)}%`,
      verdict: r >= 30 ? 'Strong' : r >= 10 ? 'Moderate' : 'Low',
      tone: r >= 30 ? 'gain' : r >= 10 ? 'warn' : 'loss',
      note: `Share of ${month} income not spent.`,
      healthy: r >= 20,
    });
  }
  if (financial > 0) {
    const r = (market / financial) * 100;
    out.push({
      key: 'equity',
      label: 'Equity exposure',
      value: `${r.toFixed(0)}%`,
      verdict: r < 20 ? 'Conservative' : r <= 60 ? 'Moderate' : 'Aggressive',
      tone: r <= 60 ? 'neutral' : 'warn',
      note: 'Stocks + funds ÷ financial assets (excludes property and receivables).',
      healthy: r <= 60,
    });
  }
  if (largest && financial > 0) {
    const r = (largest.value / financial) * 100;
    out.push({
      key: 'largest',
      label: 'Largest position',
      value: `${r.toFixed(1)}%`,
      verdict: r < 20 ? 'Diversified' : r < 35 ? 'Concentrated' : 'Very concentrated',
      tone: r < 20 ? 'gain' : r < 35 ? 'warn' : 'loss',
      note: `${largest.label} ÷ financial assets.`,
      healthy: r < 20,
    });
  }
  if (netWorth > 0) {
    const r = (property / netWorth) * 100;
    out.push({
      key: 'property',
      label: 'Property share',
      value: `${r.toFixed(0)}% of net worth`,
      verdict: r < 50 ? 'Balanced' : 'Illiquid-heavy',
      tone: r < 50 ? 'gain' : 'warn',
      note: 'Property is slow to sell; this is usually your largest single exposure.',
      healthy: r < 50,
    });
  }
  return out;
}
