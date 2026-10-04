/**
 * Net worth history rules shared by the dashboard Net worth card and Performance.
 *
 * Turns stored month-end snapshots plus today's live totals into dated observations, rates how far
 * each one can be trusted, picks the comparison point for a period, and flags changes that come
 * from accounts being added to the app rather than from wealth changing. Pure — no React or
 * fetching — so every rule here is unit-tested (tests/finance/netWorthHistory.test.ts).
 */
import type { BankBalance, FinancialSnapshot, Investment, Loan, PPFAccount, Property } from '@/shared/types';

const DAY = 864e5;

/** A snapshot saved more than this many days after its month ended was rebuilt later, not recorded at the time. */
export const RECORDED_LAG_DAYS = 10;
/** The opening observation may sit at most this many days before the period start (month-end snapshots). */
export const OPENING_TOLERANCE_DAYS = 35;
/** Share of the gross balance sheet (assets + liabilities) above which a gap or stale value is material. */
export const MATERIAL_SHARE = 0.02;
/** Above this many monthly slots the chart switches to year-end points so the interval stays even. */
const MAX_MONTH_SLOTS = 36;

/* ----------------------------------------------------------------- ranges */

export type RangeKey = '3M' | '6M' | 'YTD' | 'ALL';
export const RANGES: { value: RangeKey; label: string }[] = [
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: 'ALL', label: 'All time' },
];
export const DEFAULT_RANGE: RangeKey = 'YTD';
export const isRangeKey = (v: unknown): v is RangeKey => RANGES.some((r) => r.value === v);
export const rangeLabel = (r: RangeKey) => RANGES.find((x) => x.value === r)!.label;

/** Last moment of a calendar month (local time). */
export function monthEnd(year: number, month: number) {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

/**
 * Requested start of a period: 3M/6M roll back from today (31 May − 3M → 28 Feb, not 3 Mar),
 * YTD starts 1 January, All time has no start (null).
 */
export function rangeStart(range: RangeKey, now: Date): Date | null {
  if (range === 'ALL') return null;
  if (range === 'YTD') return new Date(now.getFullYear(), 0, 1);
  const months = range === '3M' ? 3 : 6;
  const d = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  if (d.getDate() !== now.getDate()) d.setDate(0); // day overflowed into the next month
  return d;
}

/* ----------------------------------------------------------- class values */

/**
 * The Portfolio's asset classes (usePortfolioTotals) plus loans, so every view — dashboard, sidebar,
 * Portfolio and Trends & analysis — files each balance under the same category.
 */
export type ClassKey = 'bank' | 'stocks' | 'pf' | 'property' | 'recv' | 'fd' | 'investments' | 'loans';
export type ClassValues = Record<ClassKey, number>;

export const CLASS_LABELS: Record<ClassKey, string> = {
  bank: 'Cash & bank',
  stocks: 'Stocks & funds',
  pf: 'Retirement',
  property: 'Properties',
  recv: 'Receivables',
  fd: 'Fixed deposits',
  investments: 'Other investments',
  loans: 'Loans',
};
export const ASSET_CLASSES: Exclude<ClassKey, 'loans'>[] = ['bank', 'stocks', 'pf', 'property', 'recv', 'fd', 'investments'];

const MARKET_TYPES = ['stocks', 'mutual-fund'];
const RETIREMENT_TYPES = ['nps', 'epf', 'retirement-other'];

/** Portfolio class of an investment record (same rule as usePortfolioTotals). */
export function investmentClass(type: string): ClassKey {
  if (MARKET_TYPES.includes(type)) return 'stocks';
  if (RETIREMENT_TYPES.includes(type)) return 'pf';
  if (type === 'fd') return 'fd';
  return 'investments';
}

/**
 * Portfolio-class values from a stored snapshot. Snapshots keep manual investment records as one
 * total (totalInvestments) with a per-type breakdown in which broker holdings and EPF passbooks are
 * merged under 'stocks' / 'mutual-fund' / 'provident-fund'. The breakdown is unpicked so manual
 * stock and fund records join Stocks & funds and NPS joins Retirement, as in Portfolio. When the
 * breakdown doesn't add up to the total, the split is unknown: everything stays in Other investments
 * and `split` is false.
 */
export function snapshotClasses(s: FinancialSnapshot): ClassValues & { netWorth: number; split: boolean } {
  const broker = (s.totalStocks || 0) + (s.totalMutualFunds || 0);
  const epf = s.totalPPF || 0;
  const manualTotal = s.totalInvestments || 0;
  const b = s.investmentBreakdown ?? {};
  const byClass: Record<'stocks' | 'pf' | 'fd' | 'investments', number> = { stocks: 0, pf: 0, fd: 0, investments: 0 };
  let sum = 0;
  for (const [type, v] of Object.entries(b)) {
    if (type === 'provident-fund') continue; // EPF passbooks, counted from totalPPF
    const cls = investmentClass(type) as keyof typeof byClass;
    byClass[cls] += v || 0;
    sum += v || 0;
  }
  byClass.stocks -= broker; // broker holdings were merged into the stocks / mutual-fund keys
  sum -= broker;
  const split = Math.abs(sum - manualTotal) < 1 && byClass.stocks > -1;
  return {
    bank: s.totalBankBalances || 0,
    stocks: broker + (split ? Math.max(0, byClass.stocks) : 0),
    pf: epf + (split ? byClass.pf : 0),
    property: s.totalProperties || 0,
    recv: s.totalReceivables || 0,
    fd: split ? byClass.fd : 0,
    investments: split ? byClass.investments : manualTotal,
    loans: s.totalLoans || 0,
    netWorth: s.netWorth || 0,
    split,
  };
}

const assetsOf = (c: ClassValues) => ASSET_CLASSES.reduce((s, k) => s + c[k], 0);

/* ----------------------------------------------------------- observations */

export type Quality = 'recorded' | 'estimated';
/** Why an observation is only an estimate (or, for 'empty', not a usable value at all) */
export type EstimateReason = 'rebuilt' | 'early' | 'unknown-date' | 'inconsistent' | 'empty';

export interface Observation {
  /** 'YYYY-MM' for snapshots, 'today' for the live value */
  key: string;
  /** Balance date: month-end for snapshots, now for the live value */
  date: Date;
  live: boolean;
  netWorth: number;
  assets: number;
  liabilities: number;
  classes: ClassValues;
  /** false when the snapshot's investment breakdown couldn't be split into Portfolio classes */
  split: boolean;
  quality: Quality;
  reason?: EstimateReason;
  /** When the figures were calculated/saved — differs from `date` for rebuilt snapshots */
  computedAt: Date | null;
  /** Stored snapshot id ('today' for the live value) */
  id: string;
  /** Other saves for the same month, kept for drill-down (not used in charts or comparisons) */
  alternates: Observation[];
  /** An alternate save disagrees with this one by more than rounding */
  conflict: boolean;
}

export interface History {
  /** One canonical month-end (or year-end) observation per completed month, oldest → newest */
  observations: Observation[];
  /** Saves beyond the first for the same month (kept as alternates) */
  duplicates: number;
  /** Months whose saves disagree with each other */
  conflicts: number;
  /** Snapshots for months that have not ended yet (not month-end values) */
  unfinished: number;
  /** Months whose only usable save is empty (all zero) — no data, not a zero balance */
  empty: number;
}

const parseDate = (v: string | undefined | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Canonical-save preference: recorded, then estimated, then empty; then monthly over yearly; then the latest save */
const rank = (o: Observation, monthly: boolean) =>
  (o.quality === 'recorded' ? 2e15 : o.reason === 'empty' ? 0 : 1e15) + (monthly ? 1e14 : 0) + (o.computedAt?.getTime() ?? 0) / 1e3;

/**
 * Stored snapshots → one canonical observation per completed month, oldest first. Year and month are
 * coerced to numbers and ordered by their month-end date. Every other save for the month is kept as
 * an alternate for drill-down, and a disagreement between saves is flagged rather than hidden.
 *
 * Rating: a snapshot counts as recorded only when it was saved within RECORDED_LAG_DAYS after its
 * month ended — the snapshot calculator fills market, bank, EPF and property values from whatever is
 * held on the day it runs, so one saved later is a reconstruction. An all-zero snapshot is 'empty':
 * it records that nothing was tracked yet, not a genuine zero net worth.
 */
export function buildHistory(snapshots: FinancialSnapshot[], now: Date): History {
  const byKey = new Map<string, { obs: Observation; monthly: boolean }[]>();
  let unfinished = 0;

  for (const s of snapshots) {
    const year = Number(s.year);
    const month = s.month == null ? 12 : Number(s.month);
    if (!Number.isFinite(s.netWorth) || !Number.isInteger(year) || !(month >= 1 && month <= 12)) continue;
    const date = monthEnd(year, month);
    if (date.getTime() >= now.getTime()) {
      unfinished++;
      continue;
    }
    const computedAt = parseDate(s.updatedAt) ?? parseDate(s.createdAt);
    const { netWorth: _nw, split, ...classes } = snapshotClasses(s);
    const assets = (s.totalFixedAssets || 0) + (s.totalLiquidAssets || 0);
    const liabilities = s.totalLoans || 0;

    let reason: EstimateReason | undefined;
    if (assets === 0 && liabilities === 0 && s.netWorth === 0) reason = 'empty';
    else if (!computedAt) reason = 'unknown-date';
    else {
      const lag = (computedAt.getTime() - date.getTime()) / DAY;
      if (lag > RECORDED_LAG_DAYS) reason = 'rebuilt';
      else if (lag < -1) reason = 'early';
    }
    if (!reason && Math.abs(assets - liabilities - s.netWorth) > 1) reason = 'inconsistent';

    const obs: Observation = {
      key: `${year}-${String(month).padStart(2, '0')}`,
      date,
      live: false,
      netWorth: s.netWorth,
      assets,
      liabilities,
      classes,
      split,
      quality: reason ? 'estimated' : 'recorded',
      reason,
      computedAt,
      id: s.id,
      alternates: [],
      conflict: false,
    };
    const list = byKey.get(obs.key) ?? [];
    list.push({ obs, monthly: s.month != null });
    byKey.set(obs.key, list);
  }

  let duplicates = 0;
  let conflicts = 0;
  let empty = 0;
  const observations: Observation[] = [];
  for (const list of byKey.values()) {
    list.sort((a, b) => rank(b.obs, b.monthly) - rank(a.obs, a.monthly));
    const [best, ...rest] = list;
    const canonical = best!.obs;
    canonical.alternates = rest.map((r) => r.obs).sort((a, b) => (b.computedAt?.getTime() ?? 0) - (a.computedAt?.getTime() ?? 0));
    canonical.conflict = canonical.alternates.some(
      (a) => a.reason !== 'empty' && Math.abs(a.netWorth - canonical.netWorth) > Math.max(1, Math.abs(canonical.netWorth) * 0.005),
    );
    duplicates += rest.length;
    if (canonical.conflict) conflicts++;
    if (canonical.reason === 'empty') empty++;
    observations.push(canonical);
  }
  observations.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { observations, duplicates, conflicts, unfinished, empty };
}

/** Today's figures as an observation (always recorded: it is the live balance sheet). */
export function liveObservation(classes: ClassValues, now: Date): Observation {
  const assets = assetsOf(classes);
  return {
    key: 'today',
    date: now,
    live: true,
    netWorth: assets - classes.loans,
    assets,
    liabilities: classes.loans,
    classes,
    split: true,
    quality: 'recorded',
    computedAt: now,
    id: 'today',
    alternates: [],
    conflict: false,
  };
}

/* ------------------------------------------------------------- comparison */

export type Comparison =
  | {
      status: 'ok';
      opening: Observation;
      closing: Observation;
      change: number;
      /** null when the opening net worth is zero or negative */
      pct: number | null;
      /** Requested start (null for All time) */
      requestedStart: Date | null;
      /** True when no reliable observation sat at the requested start, so a later one is used */
      later: boolean;
    }
  | { status: 'insufficient'; reason: 'no-history' | 'only-estimates'; requestedStart: Date | null };

/**
 * Opening-observation policy, the same for every range: the latest *recorded* observation on or
 * before the requested start, if it is no more than OPENING_TOLERANCE_DAYS earlier; otherwise the
 * earliest recorded observation after the start (flagged `later` so the card discloses the date).
 * All time uses the earliest recorded observation. Estimated observations are never used.
 */
export function compare(history: Observation[], live: Observation, range: RangeKey, now: Date): Comparison {
  const requestedStart = rangeStart(range, now);
  const reliable = history.filter((o) => o.quality === 'recorded' && o.date.getTime() < now.getTime());
  if (!reliable.length) return { status: 'insufficient', reason: history.length ? 'only-estimates' : 'no-history', requestedStart };

  let opening: Observation | undefined;
  let later = false;
  if (!requestedStart) opening = reliable[0];
  else {
    const floor = requestedStart.getTime() - OPENING_TOLERANCE_DAYS * DAY;
    opening = [...reliable].reverse().find((o) => o.date.getTime() <= requestedStart.getTime() && o.date.getTime() >= floor);
    if (!opening) {
      opening = reliable.find((o) => o.date.getTime() > requestedStart.getTime());
      later = !!opening;
    }
  }
  if (!opening) {
    const anyEstimate = history.some((o) => o.date.getTime() >= (requestedStart?.getTime() ?? 0) - OPENING_TOLERANCE_DAYS * DAY);
    return { status: 'insufficient', reason: anyEstimate ? 'only-estimates' : 'no-history', requestedStart };
  }
  const change = live.netWorth - opening.netWorth;
  return {
    status: 'ok',
    opening,
    closing: live,
    change,
    pct: opening.netWorth > 0 ? (change / opening.netWorth) * 100 : null,
    requestedStart,
    later,
  };
}

/* --------------------------------------------------------------- coverage */

export interface CoverageItem {
  cls: ClassKey;
  /** Effect on net worth today (negative for a liability) */
  amount: number;
  /**
   * held-before: dated records show these accounts existed at the opening date, so this is newly
   * tracked, not growth. unknown: the class was empty at the opening and records carry no start
   * date, so it may be new money or newly tracked.
   */
  basis: 'held-before' | 'unknown';
}

/** The dated records Coverage needs from the live portfolio */
export interface CoverageRecords {
  investments: Investment[];
  loans: Loan[];
  properties: Property[];
  receivables: BankBalance[];
  /** EPF passbooks: accounts accumulate over years, so one appearing in a period is always newly tracked */
  ppfAccounts: PPFAccount[];
  /** value today of each investment record (same rule as the dashboard) */
  investmentValue: (i: Investment) => number;
  /** expected value today of each receivable (same rule as the dashboard) */
  receivableValue: (r: BankBalance) => number;
}

/**
 * Value that is in today's total but was not tracked at the opening observation. A class that was
 * empty then and is material now is checked against its records' own start dates: records held
 * before the opening date are newly tracked; those started later are in-period activity (a new
 * deposit funded from tracked cash, a new loan) and stay part of the ordinary change. Records added
 * to the app after an opening that was *recorded* at the time are counted the same way even when
 * the class was not empty. Cash and market holdings carry no start dates, so they can only be
 * reported as unknown.
 */
export function coverageChanges(opening: Observation, live: Observation, rec: CoverageRecords): CoverageItem[] {
  const gross = live.assets + live.liabilities;
  const material = (v: number) => Math.abs(v) >= MATERIAL_SHARE * gross && Math.abs(v) > 0;
  const at = opening.date.getTime();
  const savedAt = opening.quality === 'recorded' ? opening.computedAt?.getTime() ?? null : null;
  const heldBefore = (start: string | undefined) => {
    const d = parseDate(start);
    return d != null && d.getTime() <= at;
  };
  const addedAfter = (created: string | undefined) => {
    const d = parseDate(created);
    return savedAt != null && d != null && d.getTime() > savedAt;
  };

  type Rec = { amount: number; start?: string; created?: string; assumeHeld?: boolean };
  const records: Record<ClassKey, Rec[]> = { bank: [], stocks: [], pf: [], property: [], recv: [], fd: [], investments: [], loans: [] };
  for (const i of rec.investments) records[investmentClass(i.type)].push({ amount: rec.investmentValue(i), start: i.startDate, created: i.createdAt });
  for (const p of rec.properties) records.property.push({ amount: p.currentValue || p.purchasePrice || 0, start: p.purchaseDate, created: p.createdAt });
  for (const r of rec.receivables) records.recv.push({ amount: rec.receivableValue(r), start: r.issueDate, created: r.createdAt });
  for (const l of rec.loans) records.loans.push({ amount: -(l.outstandingAmount || 0), start: l.startDate, created: l.createdAt });
  // EPF passbooks accumulate over years: one first appearing in a period was already held
  for (const p of rec.ppfAccounts) records.pf.push({ amount: p.grandTotal || 0, assumeHeld: true });
  // Undated remainders: bank accounts and broker holdings carry no start date
  const sumOf = (k: ClassKey) => records[k].reduce((s, r) => s + r.amount, 0);
  records.bank.push({ amount: live.classes.bank });
  records.stocks.push({ amount: live.classes.stocks - sumOf('stocks') });

  const items: CoverageItem[] = [];
  for (const cls of [...ASSET_CLASSES, 'loans'] as ClassKey[]) {
    const wasEmpty = opening.classes[cls] === 0;
    const list = records[cls];
    const untracked = list.filter((r) => (r.assumeHeld ? wasEmpty : heldBefore(r.start) && (wasEmpty || addedAfter(r.created))));
    const amount = untracked.reduce((s, r) => s + r.amount, 0);
    if (material(amount)) items.push({ cls, amount, basis: 'held-before' });
    const undated = wasEmpty ? list.filter((r) => !r.assumeHeld && !parseDate(r.start)).reduce((s, r) => s + r.amount, 0) : 0;
    if (material(undated)) items.push({ cls, amount: undated, basis: 'unknown' });
  }
  return items;
}

/* ---------------------------------------------------------- contributions */

export interface Contribution {
  cls: ClassKey;
  opening: number;
  closing: number;
  /** closing − opening of the balance itself (for loans: a rise means more owed) */
  balanceChange: number;
  /** Effect on net worth: the balance change for assets, its negative for loans */
  contribution: number;
  /** Part of the contribution from accounts already held at the opening but added to the app later */
  newlyTracked: number;
  /** contribution − newlyTracked: balance movement whose cause the records don't show */
  unclassified: number;
  /** Class empty at the opening and material at the close */
  firstAppears: boolean;
}

/**
 * Category contributions to the net-worth change between two observations. They sum to the change
 * exactly when both observations' classes add up to their net worth; any gap (an internally
 * inconsistent snapshot) is returned as `residual` rather than spread over categories.
 */
export function contributions(opening: Observation, closing: Observation, coverage: CoverageItem[] = []) {
  const gross = closing.assets + closing.liabilities;
  const rows: Contribution[] = ([...ASSET_CLASSES, 'loans'] as ClassKey[]).map((cls) => {
    const sign = cls === 'loans' ? -1 : 1;
    const balanceChange = closing.classes[cls] - opening.classes[cls];
    const contribution = sign * balanceChange;
    const newlyTracked = coverage.filter((c) => c.cls === cls && c.basis === 'held-before').reduce((s, c) => s + c.amount, 0);
    return {
      cls,
      opening: opening.classes[cls],
      closing: closing.classes[cls],
      balanceChange,
      contribution,
      newlyTracked,
      unclassified: contribution - newlyTracked,
      firstAppears: opening.classes[cls] === 0 && closing.classes[cls] > 0 && closing.classes[cls] >= MATERIAL_SHARE * gross,
    };
  });
  const change = closing.netWorth - opening.netWorth;
  const total = rows.reduce((s, r) => s + r.contribution, 0);
  return { rows, change, total, residual: change - total };
}

/* ------------------------------------------------------------------ table */

export interface TableRow {
  key: string;
  date: Date;
  live: boolean;
  /** null = no snapshot for this month (a gap) */
  obs: Observation | null;
  /** The comparable preceding observation: the latest earlier one that isn't an empty save */
  prev: Observation | null;
  /** True when `prev` is not the immediately preceding month/year (a gap or empty save in between) */
  prevSkipped: boolean;
}

/**
 * Rows for the Trends & analysis table, newest first with Today on top as a partial period.
 * Monthly: one row per month from the first observation (at most `maxMonths` back) to last month,
 * with gaps as rows of their own. Yearly: year-end observations. Each row compares with the latest
 * earlier observation that holds data, so nothing is measured against an empty save.
 */
export function tableRows(observations: Observation[], live: Observation, mode: 'monthly' | 'yearly', now: Date, maxMonths = 36): TableRow[] {
  const usable = observations.filter((o) => o.reason !== 'empty');
  const prevOf = (d: Date) => [...usable].reverse().find((o) => o.date.getTime() < d.getTime()) ?? null;
  const rows: TableRow[] = [];
  if (mode === 'monthly') {
    const byKey = new Map(observations.map((o) => [o.key, o]));
    const lastY = now.getFullYear();
    const lastM = now.getMonth(); // last completed month, 1-based (0 → December of last year)
    const end = lastM === 0 ? { y: lastY - 1, m: 12 } : { y: lastY, m: lastM };
    const first = observations[0];
    let span = first ? (end.y - first.date.getFullYear()) * 12 + (end.m - (first.date.getMonth() + 1)) + 1 : 0;
    span = Math.min(Math.max(span, 0), maxMonths);
    for (let i = 0; i < span; i++) {
      const y = end.y + Math.floor((end.m - 1 - i) / 12);
      const m = ((((end.m - 1 - i) % 12) + 12) % 12) + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const date = monthEnd(y, m);
      const prev = prevOf(date);
      const adjacent = monthEnd(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1).getTime();
      rows.push({ key, date, live: false, obs: byKey.get(key) ?? null, prev, prevSkipped: !!prev && prev.date.getTime() !== adjacent });
    }
  } else {
    const yearEnds = observations.filter((o) => o.date.getMonth() === 11).sort((a, b) => b.date.getTime() - a.date.getTime());
    for (const o of yearEnds) {
      const prev = [...usable].reverse().find((p) => p.date.getMonth() === 11 && p.date.getTime() < o.date.getTime()) ?? null;
      rows.push({ key: o.key, date: o.date, live: false, obs: o, prev, prevSkipped: !!prev && prev.date.getFullYear() !== o.date.getFullYear() - 1 });
    }
  }
  const latest = mode === 'monthly' ? usable[usable.length - 1] ?? null : [...usable].reverse().find((o) => o.date.getMonth() === 11) ?? null;
  rows.unshift({ key: 'today', date: live.date, live: true, obs: live, prev: latest, prevSkipped: false });
  return rows;
}

/* ------------------------------------------------------------------ chart */

export interface ChartPoint {
  /** Unique category key: 'YYYY-MM' or 'today' */
  key: string;
  /** Axis label: 'Mar', "Jan '26", 'Today' */
  label: string;
  date: Date;
  live: boolean;
  /** null = no observation for this slot (a gap, never zero) */
  netWorth: number | null;
  assets: number | null;
  liabilities: number | null;
  quality: Quality | null;
  reason?: EstimateReason;
  computedAt: Date | null;
  /** Value on a solid (recorded→recorded) segment ending or starting here */
  solid: number | null;
  /** Value on a dashed segment (either end estimated) */
  dashed: number | null;
  /** Assets first appear here (a class empty at the previous point): the line is broken before it */
  coverageBreak: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A class that was empty at `a` and material at `b` — accounts were added, so the two aren't comparable. */
function coverageJump(a: Observation, b: Observation) {
  const gross = b.assets + b.liabilities;
  return ([...ASSET_CLASSES, 'loans'] as ClassKey[]).some((k) => a.classes[k] === 0 && b.classes[k] >= MATERIAL_SHARE * gross && b.classes[k] > 0);
}

/**
 * Evenly spaced chart slots for a range: one per month-end from the period's first point to last
 * month, then Today. Months without a snapshot stay as gaps (null, never zero). Spans beyond
 * MAX_MONTH_SLOTS months use year-end slots. Lines join only neighbouring observations, solid when
 * both were recorded, dashed when either is estimated, and break where accounts first appear.
 */
export function chartPoints(history: Observation[], live: Observation, range: RangeKey, now: Date, opening?: Observation): ChartPoint[] {
  // The chart covers the whole requested period (estimates included); the opening is always on it
  const start = rangeStart(range, now);
  let first: Observation | undefined = history[0];
  if (start) {
    const floor = start.getTime() - OPENING_TOLERANCE_DAYS * DAY;
    first =
      [...history].reverse().find((o) => o.date.getTime() <= start.getTime() && o.date.getTime() >= floor) ??
      history.find((o) => o.date.getTime() > start.getTime());
  }
  if (opening && (!first || opening.date < first.date)) first = opening;

  const byKey = new Map(history.map((o) => [o.key, o]));
  const slots: { key: string; date: Date; obs?: Observation }[] = [];
  if (first) {
    const y0 = first.date.getFullYear();
    const m0 = first.date.getMonth() + 1;
    const last = new Date(now.getFullYear(), now.getMonth(), 0); // end of last month
    const monthsSpan = (last.getFullYear() - y0) * 12 + (last.getMonth() + 1 - m0) + 1;
    if (monthsSpan <= MAX_MONTH_SLOTS) {
      for (let i = 0; i < monthsSpan; i++) {
        const y = y0 + Math.floor((m0 - 1 + i) / 12);
        const m = ((m0 - 1 + i) % 12) + 1;
        const key = `${y}-${String(m).padStart(2, '0')}`;
        slots.push({ key, date: monthEnd(y, m), obs: byKey.get(key) });
      }
    } else {
      // Year-end slots; the first is the period's own first point so the comparison stays on the chart
      slots.push({ key: first.key, date: first.date, obs: first });
      for (let y = y0; y < now.getFullYear(); y++) {
        const key = `${y}-12`;
        if (key !== first.key && monthEnd(y, 12) > first.date) slots.push({ key, date: monthEnd(y, 12), obs: byKey.get(key) });
      }
    }
  }

  const multiYear = slots.length > 0 && slots[0].date.getFullYear() !== now.getFullYear();
  const wide = slots.length > 12;
  const points: ChartPoint[] = slots.map((s, i) => {
    const mon = MONTHS[s.date.getMonth()];
    const yy = `'${String(s.date.getFullYear()).slice(2)}`;
    const withYear = wide || (multiYear && (i === 0 || s.date.getMonth() === 0));
    const o = s.obs;
    return {
      key: s.key,
      label: withYear ? `${mon} ${yy}` : mon,
      date: s.date,
      live: false,
      netWorth: o?.netWorth ?? null,
      assets: o?.assets ?? null,
      liabilities: o?.liabilities ?? null,
      quality: o?.quality ?? null,
      reason: o?.reason,
      computedAt: o?.computedAt ?? null,
      solid: null,
      dashed: null,
      coverageBreak: false,
    };
  });
  points.push({
    key: 'today',
    label: 'Today',
    date: live.date,
    live: true,
    netWorth: live.netWorth,
    assets: live.assets,
    liabilities: live.liabilities,
    quality: 'recorded',
    computedAt: live.computedAt,
    solid: null,
    dashed: null,
    coverageBreak: false,
  });

  const obsAt = (i: number) => (i === points.length - 1 ? live : slots[i]?.obs);
  for (let i = 1; i < points.length; i++) {
    const a = obsAt(i - 1);
    const b = obsAt(i);
    if (!a || !b) continue;
    if (coverageJump(a, b)) {
      points[i].coverageBreak = true;
      continue;
    }
    const field = a.quality === 'recorded' && b.quality === 'recorded' ? 'solid' : 'dashed';
    points[i - 1][field] = a.netWorth;
    points[i][field] = b.netWorth;
  }
  return points;
}

/* ------------------------------------------------- current-value quality */

/** stale: balance date known and old · undated: no balance date recorded · estimated: owner estimate · missing: no figure */
export type IssueKind = 'stale' | 'undated' | 'estimated' | 'missing';

export interface ValueIssue {
  source: string;
  kind: IssueKind;
  /** Amount affected (absolute rupees) */
  amount: number;
  material: boolean;
  /** Oldest balance date behind the figure, when known */
  asOf: Date | null;
  detail: string;
}

export type SourceStatus = 'current' | 'stale' | 'undated' | 'estimate' | 'missing' | 'connected' | 'disconnected' | 'checking';

export interface SourceDates {
  source: string;
  /** Date the balance or valuation refers to (statement / entry / valuation date), when recorded */
  balanceDate: Date | null;
  /** When the figure was imported or last refreshed in the app — never proof the balance is current */
  refreshed: Date | null;
  status: SourceStatus;
  note?: string;
  href: string;
}

/** Days after which a manually entered balance is out of date — same thresholds as the Data freshness panel. */
export const STALE_DAYS = { bank: 60, loans: 95, epf: 60 } as const;

/** Latest lender statement per loan (from loan snapshots): the loan balance's effective date */
export interface LoanStatement {
  date: Date;
  outstanding: number;
  emi: number;
}

export interface CurrentInputs {
  cashAccounts: BankBalance[];
  loans: Loan[];
  /** keyed by loan id; loans without one have no recorded balance date */
  loanStatements?: Record<string, LoanStatement>;
  properties: Property[];
  ppfAccounts: PPFAccount[];
  marketValue: number;
  /** true = live broker prices, false = cached prices, undefined = unknown yet */
  marketLive: boolean | undefined;
  assets: number;
  liabilities: number;
  now: Date;
}

const oldestDate = (ds: (Date | null)[]) => ds.filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
const newestDate = (ds: (Date | null)[]) => ds.filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

/**
 * What stands behind today's total: stale or undated balances, owner-estimated property values,
 * cached market prices and missing figures, each marked material when it is at least
 * MATERIAL_SHARE of the gross balance sheet. Freshness always comes from the balance's own date
 * (bank "last updated", the lender statement month), never from when it was imported.
 * Also returns per-source balance vs import dates and a status for the Data freshness summary.
 */
export function assessCurrent(x: CurrentInputs): { issues: ValueIssue[]; sources: SourceDates[] } {
  const gross = x.assets + x.liabilities;
  const isMaterial = (v: number) => gross > 0 && Math.abs(v) >= MATERIAL_SHARE * gross;
  const age = (d: Date | null) => (d ? (x.now.getTime() - d.getTime()) / DAY : Infinity);
  const issues: ValueIssue[] = [];
  const push = (source: string, kind: IssueKind, amount: number, asOf: Date | null, detail: string) =>
    amount !== 0 || kind === 'missing' ? issues.push({ source, kind, amount, material: kind === 'missing' || isMaterial(amount), asOf, detail }) : undefined;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

  // Bank balances: the balance date is lastUpdated (entered per account)
  const bankMissing = x.cashAccounts.filter((b) => !Number.isFinite(b.balance));
  if (bankMissing.length) push('Bank balances', 'missing', 0, null, `${plural(bankMissing.length, 'account')} without a balance`);
  const bankDated = x.cashAccounts.filter((b) => Number.isFinite(b.balance));
  const bankStale = bankDated.filter((b) => parseDate(b.lastUpdated) && age(parseDate(b.lastUpdated)) > STALE_DAYS.bank);
  const bankUndated = bankDated.filter((b) => !parseDate(b.lastUpdated));
  push('Bank balances', 'stale', bankStale.reduce((s, b) => s + (b.balance || 0), 0), oldestDate(bankStale.map((b) => parseDate(b.lastUpdated))), `${plural(bankStale.length, 'account')} not updated in ${STALE_DAYS.bank}+ days`);
  push('Bank balances', 'undated', bankUndated.reduce((s, b) => s + (b.balance || 0), 0), null, `${plural(bankUndated.length, 'account')} without a balance date`);

  // Loans: the effective date is the latest lender statement, not the import
  const statements = x.loanStatements ?? {};
  const loanMissing = x.loans.filter((l) => !Number.isFinite(l.outstandingAmount));
  if (loanMissing.length) push('Loans', 'missing', 0, null, `${plural(loanMissing.length, 'active loan')} without an outstanding balance`);
  const loanOk = x.loans.filter((l) => Number.isFinite(l.outstandingAmount));
  const loanStale = loanOk.filter((l) => statements[l.id] && age(statements[l.id]!.date) > STALE_DAYS.loans);
  const loanUndated = loanOk.filter((l) => !statements[l.id]);
  push('Loans', 'stale', loanStale.reduce((s, l) => s + (l.outstandingAmount || 0), 0), oldestDate(loanStale.map((l) => statements[l.id]!.date)), `latest statement older than ${STALE_DAYS.loans} days — balance likely lower now`);
  push('Loans', 'undated', loanUndated.reduce((s, l) => s + (l.outstandingAmount || 0), 0), null, `${plural(loanUndated.length, 'loan')} with no lender statement on file — balance date unknown`);

  // EPF: only the import date is stored; an old import is certainly stale, a recent one is undated
  const epfDate = (p: PPFAccount) => parseDate(p.lastUpdated) ?? parseDate(p.extractedAt);
  const epfStale = x.ppfAccounts.filter((p) => age(epfDate(p)) > STALE_DAYS.epf);
  push('EPF', 'stale', epfStale.reduce((s, p) => s + (p.grandTotal || 0), 0), oldestDate(epfStale.map(epfDate)), `passbook imported more than ${STALE_DAYS.epf} days ago`);

  // Properties: owner estimates; at cost when no current value was entered
  const atCost = x.properties.filter((p) => !p.currentValue);
  const valued = x.properties.filter((p) => !!p.currentValue);
  push('Properties', 'estimated', valued.reduce((s, p) => s + (p.currentValue || 0), 0), oldestDate(valued.map((p) => parseDate(p.updatedAt))), 'owner estimate');
  push('Properties', 'estimated', atCost.reduce((s, p) => s + (p.purchasePrice || 0), 0), null, 'no current value — counted at purchase price');

  // Market holdings
  if (x.marketLive === false) push('Stocks & funds', 'stale', x.marketValue, null, 'broker not connected — last synced prices');

  const bankOldest = oldestDate(x.cashAccounts.map((b) => parseDate(b.lastUpdated)));
  const loanOldest = oldestDate(x.loans.map((l) => statements[l.id]?.date ?? null));
  const epfOldest = oldestDate(x.ppfAccounts.map(epfDate));
  const sources: SourceDates[] = [];
  if (x.cashAccounts.length)
    sources.push({
      source: 'Bank balances',
      balanceDate: bankOldest,
      refreshed: newestDate(x.cashAccounts.map((b) => parseDate(b.updatedAt))),
      status: bankMissing.length ? 'missing' : bankStale.length ? 'stale' : bankUndated.length ? 'undated' : 'current',
      note: 'oldest account balance date · manual entry',
      href: '/portfolio/bank-balances',
    });
  if (x.loans.length)
    sources.push({
      source: 'Loans',
      balanceDate: loanOldest,
      refreshed: oldestDate(x.loans.map((l) => parseDate(l.updatedAt))),
      status: loanMissing.length ? 'missing' : loanStale.length ? 'stale' : loanUndated.length ? 'undated' : 'current',
      note: loanUndated.length ? 'no lender statement on file for some loans' : 'latest lender statement',
      href: '/portfolio/loans',
    });
  if (x.ppfAccounts.length)
    sources.push({
      source: 'EPF',
      balanceDate: null,
      refreshed: epfOldest,
      status: epfStale.length ? 'stale' : 'undated',
      note: 'passbook date not stored — import date shown',
      href: '/portfolio/provident-fund',
    });
  if (x.properties.length)
    sources.push({
      source: 'Properties',
      balanceDate: oldestDate(x.properties.map((p) => parseDate(p.updatedAt))),
      refreshed: null,
      status: 'estimate',
      note: atCost.length ? 'owner estimates; some at purchase price' : 'owner estimates',
      href: '/portfolio/properties',
    });
  if (x.marketValue > 0)
    sources.push({
      source: 'Stocks & funds',
      balanceDate: x.marketLive ? x.now : null,
      refreshed: null,
      status: x.marketLive ? 'connected' : x.marketLive === false ? 'disconnected' : 'checking',
      note: x.marketLive ? 'broker connected · live prices' : x.marketLive === false ? 'broker not connected · last synced prices (sync date not stored)' : 'checking broker connection',
      href: '/portfolio/stocks',
    });

  return { issues, sources };
}
