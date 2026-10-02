'use client';

import { useCallback, useMemo } from 'react';
import { useTheme } from '@/shared/providers/ThemeProvider';
import { convertFromINR } from '@/shared/utils/currency';

const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MINUS = '−';

/**
 * Display formatting for money, following the design's rules:
 * Indian grouping (₹1,00,000), at most two decimals, a true minus sign,
 * the display currency from Settings (INR or NPR) and privacy mode (masked amounts).
 * All inputs are INR (the app's base currency).
 */
export function useMoney() {
  const { currency, hidden } = useTheme();
  const sym = currency === 'INR' ? '₹' : 'Rs ';

  const toDisplay = useCallback((inr: number) => (currency === 'INR' ? inr : convertFromINR(inr, 'NPR')), [currency]);

  /** Full amount: ₹2,86,18,286 (dec=2 → ₹2,86,18,286.00) */
  const M = useCallback(
    (inr: number | null | undefined, dec = 0) => {
      if (inr == null || Number.isNaN(inr)) return 'Not available';
      if (hidden) return sym + '••••••';
      const x = toDisplay(inr);
      return (x < 0 ? MINUS : '') + sym + (dec ? nf2 : nf0).format(Math.abs(x));
    },
    [hidden, sym, toDisplay],
  );

  /** Compact amount: ₹2.86 Cr, ₹67.05 L, ₹48,250 */
  const C = useCallback(
    (inr: number | null | undefined) => {
      if (inr == null || Number.isNaN(inr)) return '—';
      if (hidden) return sym + '••••';
      const x = toDisplay(inr);
      const a = Math.abs(x);
      const s = x < 0 ? MINUS : '';
      if (a >= 1e7) return `${s}${sym}${(a / 1e7).toFixed(2)} Cr`;
      if (a >= 1e5) return `${s}${sym}${(a / 1e5).toFixed(2)} L`;
      return s + sym + nf0.format(a);
    },
    [hidden, sym, toDisplay],
  );

  /** Signed change: +₹4,15,206 / −₹83,829 (compact=true uses C) */
  const S = useCallback(
    (inr: number | null | undefined, opts: { dec?: number; compact?: boolean } = {}) => {
      if (inr == null || Number.isNaN(inr)) return '—';
      const body = opts.compact ? C(Math.abs(inr)) : M(Math.abs(inr), opts.dec ?? 0);
      if (Math.abs(inr) < 0.005) return body;
      return (inr > 0 ? '+' : MINUS) + body;
    },
    [C, M],
  );

  /** Amount in its original currency, e.g. Rs 9,99,999.94 */
  const O = useCallback(
    (amount: number | null | undefined, ccy?: string) => {
      if (amount == null || Number.isNaN(amount)) return 'Not available';
      const sy = ccy === 'NPR' ? 'Rs ' : ccy === 'USD' ? '$' : '₹';
      if (hidden) return sy + '••••';
      return (amount < 0 ? MINUS : '') + sy + nf2.format(Math.abs(amount));
    },
    [hidden],
  );

  return useMemo(() => ({ M, C, S, O, currency, hidden, sym }), [M, C, S, O, currency, hidden, sym]);
}

/** Percentage with a fixed number of decimals: 21.9% */
export function pct(value: number, dec = 1) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(dec)}%`;
}

/** Tone for a signed value — gains/losses always use gain/loss tokens, never the accent. */
export function toneOf(value: number | null | undefined): 'gain' | 'loss' | 'muted' {
  if (value == null || Math.abs(value) < 0.005) return 'muted';
  return value > 0 ? 'gain' : 'loss';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 2 Oct 2026 */
export function fmtDate(input: string | Date | null | undefined) {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Fri 2 Oct 2026 */
export function fmtDay(d: Date = new Date()) {
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${fmtDate(d)}`;
}

export function monthShort(m: number) {
  return MONTHS[(m - 1 + 12) % 12];
}
