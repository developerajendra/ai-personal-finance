/**
 * Rules behind the dashboard's compact cards: loan EMI checks, debt summary, cash cover, liquidity
 * tiers, upcoming commitments, investment performance, subscriptions, cash flow and the Needs
 * attention ranking. Pure (no React or fetching) so each rule is unit-tested
 * (tests/finance/dashboardInsights.test.ts). Nothing here writes or "fixes" a record — conflicts are
 * reported for the user to resolve.
 */
import type { BankBalance, BudgetItem, Investment, Loan, PPFAccount, Property, Subscription, Transaction } from '@/shared/types';
import { getCurrentInvestmentValue } from '@/shared/utils/investmentValue';

const DAY = 864e5;

const parseDate = (v: string | undefined | null) => {
  if (!v) return null;
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/* ------------------------------------------------------------------- EMI */

/** Standard amortising EMI for the recorded terms, or null when the terms are incomplete. */
export function amortisedEmi(principal: number, annualRatePct: number, months: number): number | null {
  if (!(principal > 0) || !(months > 0) || !(annualRatePct >= 0)) return null;
  const r = annualRatePct / 1200;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

/**
 * known: a recorded EMI consistent with the loan's terms (or terms too incomplete to check).
 * unknown: no EMI recorded — distinct from zero, never summed as 0.
 * implausible: the recorded EMI cannot be a monthly payment (more than the principal, or over 3× what
 *   the recorded terms imply) — likely a balance entered in the EMI field; excluded from totals.
 * mismatch: more than 25% away from what the recorded terms imply — kept in totals but marked
 *   unverified (an estimate, a rate change, or wrong terms).
 */
export type EmiStatus = 'known' | 'unknown' | 'implausible' | 'mismatch';

export interface EmiCheck {
  status: EmiStatus;
  /** The recorded EMI when usable (known or mismatch), else null */
  emi: number | null;
  /** EMI implied by principal, rate and tenure, when those are recorded */
  expected: number | null;
}

export function emiCheck(l: Pick<Loan, 'emiAmount' | 'principalAmount' | 'interestRate' | 'tenureMonths'>): EmiCheck {
  const expected = amortisedEmi(l.principalAmount, l.interestRate, l.tenureMonths);
  const emi = l.emiAmount;
  if (emi == null || !Number.isFinite(emi) || emi <= 0) return { status: 'unknown', emi: null, expected };
  if ((l.principalAmount > 0 && emi > l.principalAmount) || (expected != null && emi > expected * 3)) return { status: 'implausible', emi: null, expected };
  if (expected != null && Math.abs(emi - expected) / expected > 0.25) return { status: 'mismatch', emi, expected };
  return { status: 'known', emi, expected };
}

/** Next EMI date on or after today for a loan's EMI day (clamped to the month's last day), or null after its end date. */
export function nextEmiDate(l: Pick<Loan, 'emiDate' | 'endDate'>, now: Date): Date | null {
  const today = startOfDay(now);
  const day = Math.max(1, l.emiDate || 1);
  for (let i = 0; i < 2; i++) {
    const last = new Date(today.getFullYear(), today.getMonth() + i + 1, 0).getDate();
    const d = new Date(today.getFullYear(), today.getMonth() + i, Math.min(day, last));
    if (d >= today) {
      const end = parseDate(l.endDate);
      return end && d > end ? null : d;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ debt */

export interface DebtSummary {
  outstanding: number;
  /** Sum of usable EMIs (known + mismatch) */
  knownEmi: number;
  /** Some active loan's EMI is unknown, implausible or unverified, so knownEmi is not the full monthly commitment */
  incomplete: boolean;
  checks: { loan: Loan; check: EmiCheck }[];
  next: { loan: Loan; date: Date; amount: number | null } | null;
  /** Loans whose latest lender statement disagrees materially with the loan record */
  statementConflicts: { loan: Loan; record: number; statement: number; date: Date }[];
}

export function debtSummary(loans: Loan[], now: Date, statements: Record<string, { date: Date; outstanding: number }> = {}): DebtSummary {
  const active = loans.filter((l) => l.status === 'active');
  const checks = active.map((loan) => ({ loan, check: emiCheck(loan) }));
  const knownEmi = checks.reduce((s, c) => s + (c.check.emi ?? 0), 0);
  let next: DebtSummary['next'] = null;
  for (const { loan, check } of checks) {
    const d = nextEmiDate(loan, now);
    if (d && (!next || d < next.date)) next = { loan, date: d, amount: check.emi };
  }
  const statementConflicts = active.flatMap((loan) => {
    const s = statements[loan.id];
    if (!s) return [];
    const diff = Math.abs(s.outstanding - loan.outstandingAmount);
    return diff > Math.max(1000, loan.outstandingAmount * 0.01) ? [{ loan, record: loan.outstandingAmount, statement: s.outstanding, date: s.date }] : [];
  });
  return {
    outstanding: active.reduce((s, l) => s + (l.outstandingAmount || 0), 0),
    knownEmi,
    incomplete: checks.some((c) => c.check.status !== 'known'),
    checks,
    next,
    statementConflicts,
  };
}

/* ------------------------------------------------------------ cash cover */

export type CoverStatus = 'ok' | 'provisional' | 'unavailable';

export interface CashCover {
  balance: number;
  /** Oldest balance date among accounts (their own "last updated", not the import date) */
  oldest: Date | null;
  newest: Date | null;
  staleAccounts: BankBalance[];
  undatedAccounts: BankBalance[];
  /** Monthly spending basis: Budget plan (user estimate, monthly equivalent) + usable loan EMIs */
  planned: number;
  emi: number;
  monthly: number | null;
  months: number | null;
  status: CoverStatus;
  /** Why the figure is provisional or unavailable */
  reasons: string[];
}

/**
 * Months of planned spending the recorded cash covers. The spending basis is the user's Budget plan
 * (an estimate, not actual spending): active expense items at their monthly equivalent, excluding
 * items linked to a loan, plus the loans' usable EMIs — so EMIs are counted once. Without a plan it
 * is unavailable; with an unknown/implausible EMI or mostly stale balances it is provisional.
 */
export function cashCover(input: { cashAccounts: BankBalance[]; budgetItems: BudgetItem[] | null; loans: Loan[]; now: Date; staleDays: number }): CashCover {
  const { cashAccounts, budgetItems, loans, now, staleDays } = input;
  const balance = cashAccounts.reduce((s, b) => s + (Number.isFinite(b.balance) ? b.balance : 0), 0);
  const dates = cashAccounts.map((b) => parseDate(b.lastUpdated));
  const valid = dates.filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
  const staleAccounts = cashAccounts.filter((b) => {
    const d = parseDate(b.lastUpdated);
    return d != null && (now.getTime() - d.getTime()) / DAY > staleDays;
  });
  const undatedAccounts = cashAccounts.filter((b) => !parseDate(b.lastUpdated));

  const reasons: string[] = [];
  const expenses = (budgetItems ?? []).filter((i) => i.active && i.kind === 'expense' && !i.loanId);
  const planned = expenses.reduce((s, i) => s + (i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0);
  const debt = debtSummary(loans, now);
  const emi = debt.knownEmi;

  let status: CoverStatus = 'ok';
  if (budgetItems == null || expenses.length === 0) {
    status = 'unavailable';
    reasons.push('No monthly expenses are planned in Budget, so spending is unknown.');
  } else {
    const badEmi = debt.checks.filter((c) => c.check.status === 'unknown' || c.check.status === 'implausible');
    if (badEmi.length) {
      status = 'provisional';
      reasons.push(`${badEmi.map((c) => c.loan.name).join(', ')}: EMI ${badEmi.length === 1 ? 'is' : 'are'} unknown or implausible and not included.`);
    }
    if (debt.checks.some((c) => c.check.status === 'mismatch')) {
      status = 'provisional';
      reasons.push('An EMI does not match its loan terms and is unverified.');
    }
    const staleShare = balance > 0 ? staleAccounts.reduce((s, b) => s + (b.balance || 0), 0) / balance : 0;
    if (staleShare > 0.5) {
      status = 'provisional';
      reasons.push('Most of the cash balance is more than ' + staleDays + ' days old.');
    }
  }
  const monthly = status === 'unavailable' ? null : planned + emi;
  return {
    balance,
    oldest: valid[0] ?? null,
    newest: valid[valid.length - 1] ?? null,
    staleAccounts,
    undatedAccounts,
    planned,
    emi,
    monthly,
    months: monthly && monthly > 0 ? balance / monthly : null,
    status,
    reasons,
  };
}

/* ------------------------------------------------------------- liquidity */

export interface LiquidityLine {
  key: string;
  label: string;
  /** Timing and conditions, e.g. "Sale + T+1 settlement; price moves daily" */
  note: string;
  value: number;
  /** Date the value refers to, when known */
  asOf: Date | null;
}

export interface LiquidityTier {
  key: 'now' | 'soon' | 'long';
  label: string;
  timing: string;
  lines: LiquidityLine[];
  total: number;
}

const FD_LIKE = (i: Investment) => i.type === 'fd';

/**
 * Three tiers by how and when money can be reached, with the distinctions kept in `lines`:
 * now = bank balances (as recorded); soon = saleable market holdings (sale + settlement, price risk),
 * deposits maturing within 90 days, and deposits breakable early at a cost; long = deposits marked
 * fixed or maturing later without a break option, PPF and other long-term records, retirement money
 * (withdrawal subject to eligibility) and property (needs a sale). Receivables are returned
 * separately because their timing depends on the borrower.
 */
export function liquidityTiers(input: {
  cashAccounts: BankBalance[];
  /** non-closed, non-retirement, non-market investment records (fixed deposits + other investments) */
  deposits: Investment[];
  marketValue: number;
  marketLive: boolean | undefined;
  retirement: number;
  ppfAccounts: PPFAccount[];
  properties: Property[];
  receivables: number;
  now: Date;
}): { tiers: LiquidityTier[]; receivables: LiquidityLine } {
  const { now } = input;
  const oldest = (ds: (string | undefined)[]) => ds.map(parseDate).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const cashNow = input.cashAccounts.filter((b) => !(b.assetType === 'fixed' || b.accountType === 'fd' || b.accountType === 'rd'));
  const bankDeposits = input.cashAccounts.filter((b) => b.assetType === 'fixed' || b.accountType === 'fd' || b.accountType === 'rd');

  let maturingSoon = 0;
  let breakable = 0;
  let locked = 0;
  let longTerm = 0;
  for (const inv of input.deposits) {
    const v = getCurrentInvestmentValue(inv);
    const m = parseDate(inv.maturityDate);
    const days = m ? (m.getTime() - now.getTime()) / DAY : null;
    if (days != null && days <= 90) maturingSoon += v; // includes matured payouts not yet recorded
    else if (FD_LIKE(inv) && inv.assetType !== 'fixed') breakable += v;
    else if (FD_LIKE(inv)) locked += v;
    else longTerm += v;
  }
  const bankDepositValue = bankDeposits.reduce((s, b) => s + (b.balance || 0), 0);
  const property = input.properties.reduce((s, p) => s + (p.currentValue || p.purchasePrice || 0), 0);

  const line = (key: string, label: string, note: string, value: number, asOf: Date | null = null): LiquidityLine => ({ key, label, note, value, asOf });
  const tiers: LiquidityTier[] = [
    {
      key: 'now',
      label: 'Available now',
      timing: 'Today, if the recorded balances are current',
      lines: [line('cash', 'Cash in bank accounts', 'Savings and current accounts, at their recorded balance date', cashNow.reduce((s, b) => s + (b.balance || 0), 0), oldest(cashNow.map((b) => b.lastUpdated)))],
      total: 0,
    },
    {
      key: 'soon',
      label: 'Accessible soon',
      timing: 'Days to about 3 months; value or cost not guaranteed',
      lines: [
        line(
          'market',
          'Stocks & funds',
          `Need a sale, then T+1 to T+3 settlement; price moves daily${input.marketLive === false ? ' · last synced prices' : ''}`,
          input.marketValue,
          input.marketLive ? now : null,
        ),
        line('maturing', 'Deposits maturing within 90 days', 'Paid out at maturity, including matured payouts not yet recorded', maturingSoon),
        line('breakable', 'Deposits breakable early', 'Premature withdrawal allowed, usually with an interest penalty', breakable + bankDepositValue),
      ],
      total: 0,
    },
    {
      key: 'long',
      label: 'Long-term or restricted',
      timing: 'Months or longer, or only when conditions are met',
      lines: [
        line('locked', 'Deposits without early access', 'Marked fixed (e.g. tax-saving): available at maturity', locked),
        line('other', 'PPF, bonds and other investments', 'Withdrawal or sale terms vary by product', longTerm),
        line('retirement', 'Retirement (EPF, NPS)', 'Withdrawal subject to eligibility — age, job change or specific purposes', input.retirement, oldest(input.ppfAccounts.map((p) => p.lastUpdated ?? p.extractedAt))),
        line('property', 'Property', 'Requires a sale, typically months; value is an owner estimate', property, oldest(input.properties.map((p) => p.updatedAt))),
      ],
      total: 0,
    },
  ];
  for (const t of tiers) {
    t.lines = t.lines.filter((l) => l.value !== 0);
    t.total = t.lines.reduce((s, l) => s + l.value, 0);
  }
  return {
    tiers,
    receivables: line('recv', 'Receivables', 'Money you lent: timing depends on the borrower; not counted as available', input.receivables),
  };
}

/* ----------------------------------------------------- investment summary */

export interface InvestmentSummary {
  /** Broker holdings with a price and an average cost */
  holdings: number;
  marketValue: number;
  cost: number | null;
  /** Lifetime unrealised gain on broker holdings (value − cost), not a period return */
  unrealised: number | null;
  unrealisedPct: number | null;
  /** Manually recorded stock/fund records: in the value, but with no market price or cost tracking */
  manualValue: number;
  manualCount: number;
  priced: boolean | undefined;
}

export function investmentSummary(input: {
  stocks: { last_price?: number; quantity?: number; average_price?: number }[];
  funds: { last_price?: number; quantity?: number; average_price?: number }[];
  manualMarket: Investment[];
  marketLive: boolean | undefined;
}): InvestmentSummary {
  const all = [...input.stocks, ...input.funds];
  const marketValue = all.reduce((s, h) => s + (h.last_price || 0) * (h.quantity || 0), 0);
  const costKnown = all.every((h) => (h.average_price ?? 0) > 0 || !(h.quantity ?? 0));
  const cost = all.length && costKnown ? all.reduce((s, h) => s + (h.average_price || 0) * (h.quantity || 0), 0) : null;
  const unrealised = cost != null ? marketValue - cost : null;
  const manualValue = input.manualMarket.reduce((s, i) => s + getCurrentInvestmentValue(i), 0);
  return {
    holdings: all.length,
    marketValue,
    cost,
    unrealised,
    unrealisedPct: unrealised != null && cost ? (unrealised / cost) * 100 : null,
    manualValue,
    manualCount: input.manualMarket.length,
    priced: input.marketLive,
  };
}

/* ---------------------------------------------------------- subscriptions */

export interface SubscriptionSummary {
  /** Sum of monthly equivalents (yearly ÷ 12) — a running rate, not a bill */
  monthlyEquivalent: number;
  active: number;
  /** Renewals actually billed in the window, at their full per-cycle amount */
  dueSoon: { sub: Subscription; date: Date; amount: number }[];
}

/** Monthly-equivalent cost vs actual renewals in the next `days` (full annual amounts land in the window they renew). */
export function subscriptionSummary(subs: Subscription[], perCycle: (s: Subscription) => number, now: Date, days = 30): SubscriptionSummary {
  const active = subs.filter((s) => s.status === 'Active');
  const today = startOfDay(now);
  const until = new Date(today.getTime() + days * DAY);
  const dueSoon: SubscriptionSummary['dueSoon'] = [];
  for (const s of active) {
    if (s.ends) continue; // cancelled at period end: it will not renew
    const d = parseDate(s.nextDate);
    if (!d) continue;
    const step = s.cycle === 'Yearly' ? 12 : 1;
    const next = new Date(d);
    for (let g = 0; next < today && g < 600; g++) next.setMonth(next.getMonth() + step);
    if (next <= until) dueSoon.push({ sub: s, date: next, amount: perCycle(s) });
  }
  dueSoon.sort((a, b) => a.date.getTime() - b.date.getTime());
  return {
    monthlyEquivalent: active.reduce((sum, s) => sum + perCycle(s) / (s.cycle === 'Yearly' ? 12 : 1), 0),
    active: active.length,
    dueSoon,
  };
}

/* ------------------------------------------------------------- cash flow */

const TRANSFER = /transfer|self|own account|sweep/i;
const INVESTMENT = /invest|sip|mutual|stock|share|fd|deposit/i;
const LOAN = /loan|emi|disburs/i;

export interface CashFlowMonth {
  month: string;
  income: number;
  spending: number;
  surplus: number;
  /** debits classified as loan repayments (principal + interest together) — shown separately, not as spending */
  loanPayments: number;
  partial: boolean;
}

/**
 * Current-month cash flow, only when transactions can be classified reliably: at least 90% of the
 * month's credit and debit value carries a category other than "uncategorized". Transfers are
 * excluded; loan proceeds are not income; investment purchases are not spending; loan repayments
 * are reported separately (the data does not split principal from interest).
 */
export function cashFlowThisMonth(transactions: Transaction[], now: Date) {
  return cashFlowForMonth(transactions, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, true);
}

/** A complete month needs at least this many transactions to count as a full statement rather than a few manual entries. */
export const MIN_MONTH_TRANSACTIONS = 10;

const prevMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y!, m! - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * The same rules for any month ('yyyy-mm'); `partial` marks a month still in progress. Being
 * categorised is not proof of completeness, so a complete month also needs MIN_MONTH_TRANSACTIONS,
 * and a partial month is shown only when the previous complete month passes.
 */
export function cashFlowForMonth(transactions: Transaction[], month: string, partial: boolean): { status: 'ok'; flow: CashFlowMonth } | { status: 'unavailable'; reason: string } {
  const rows = transactions.filter((t) => (t.date || '').startsWith(month));
  if (!rows.length) return { status: 'unavailable', reason: 'No transactions recorded this month.' };
  if (partial) {
    const before = cashFlowForMonth(transactions, prevMonth(month), false);
    if (before.status !== 'ok') return { status: 'unavailable', reason: `Last month's transactions aren't complete enough to trust this month's partial figures (${before.reason.replace(/\.$/, '').toLowerCase()}).` };
  } else if (rows.length < MIN_MONTH_TRANSACTIONS) {
    return { status: 'unavailable', reason: `Only ${rows.length} transaction${rows.length === 1 ? '' : 's'} recorded — too few to be a full month.` };
  }
  const value = rows.reduce((s, t) => s + Math.abs(t.amount), 0);
  const uncategorised = rows.filter((t) => !t.category || /uncategori[sz]ed/i.test(t.category)).reduce((s, t) => s + Math.abs(t.amount), 0);
  if (value === 0 || uncategorised / value > 0.1) {
    return { status: 'unavailable', reason: `${Math.round((uncategorised / (value || 1)) * 100)}% of this month's transaction value is uncategorised, so transfers, loan proceeds and investments can't be separated from income and spending.` };
  }
  let income = 0;
  let spending = 0;
  let loanPayments = 0;
  for (const t of rows) {
    const tag = `${t.category} ${t.description ?? ''}`;
    const amt = Math.abs(t.amount);
    if (TRANSFER.test(tag)) continue;
    if (t.type === 'credit') {
      if (LOAN.test(t.category) || INVESTMENT.test(t.category)) continue; // loan proceeds, investment redemptions
      income += amt;
    } else {
      if (INVESTMENT.test(t.category)) continue;
      if (LOAN.test(t.category)) loanPayments += amt;
      else spending += amt;
    }
  }
  return { status: 'ok', flow: { month, income, spending, surplus: income - spending - loanPayments, loanPayments, partial } };
}

/* ------------------------------------------------------- needs attention */

/**
 * Tier 1 — money at risk or overdue (overdue receivables, matured deposits with no payout recorded).
 * Tier 2 — records that make totals or commitments wrong (implausible/unknown EMIs, loan record vs
 *   statement conflicts, missing balances, a broker connection that has dropped).
 * Tier 3 — material balances that are stale or have no balance date.
 * Within a tier: larger amount first.
 */
export interface Attention {
  key: string;
  tier: 1 | 2 | 3;
  title: string;
  /** Specific reason */
  reason: string;
  /** Clear action */
  action: string;
  href: string;
  /** Amount affected (₹), for ordering */
  impact: number;
}

export const ATTENTION_RULE = 'Ordered by urgency (overdue money, then records that make totals wrong, then out-of-date balances), then by amount affected.';

export function rankAttention(items: Attention[]): Attention[] {
  const seen = new Set<string>();
  return items
    .filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)))
    .sort((a, b) => a.tier - b.tier || Math.abs(b.impact) - Math.abs(a.impact));
}
