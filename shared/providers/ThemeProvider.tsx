'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const SKINS = ['Apple', 'Midnight', 'Sand', 'Mint', 'Private'] as const;
export const ACCENTS = ['Blue', 'Indigo', 'Graphite', 'Teal', 'Purple', 'Navy', 'Orange', 'Pink'] as const;
export type Skin = (typeof SKINS)[number];
export type Accent = (typeof ACCENTS)[number];
export type DisplayCurrency = 'INR' | 'NPR';

/** Swatch shown in the accent picker (the accent's base colour). */
export const ACCENT_SWATCH: Record<Accent, string> = {
  Blue: '#0071e3',
  Indigo: '#5856d6',
  Graphite: '#3a3a3c',
  Teal: '#0e8a9b',
  Purple: '#8944ab',
  Navy: '#1d3d8f',
  Orange: '#e8590c',
  Pink: '#d6336c',
};

const KEYS = {
  skin: 'pf-theme',
  accent: 'pf-accent',
  currency: 'pf-currency',
  hidden: 'pf-hidden',
} as const;

/** Preference keys from when the app was branded "Ledger"; copied to the new keys once. */
const LEGACY_KEYS: [string, string][] = [
  ['ledger-theme', KEYS.skin],
  ['ledger-accent', KEYS.accent],
  ['ledger-currency', KEYS.currency],
  ['ledger-hidden', KEYS.hidden],
  ['ledger-nav-hidden', 'pf-nav-hidden'],
];

/** Inline script run in <head>: carries over legacy preferences, then applies the saved skin/accent before first paint. */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=${JSON.stringify(LEGACY_KEYS)};for(var i=0;i<m.length;i++){var o=localStorage.getItem(m[i][0]);if(o!==null){if(localStorage.getItem(m[i][1])===null)localStorage.setItem(m[i][1],o);localStorage.removeItem(m[i][0]);}}}catch(e){}try{var d=document.documentElement;var s=localStorage.getItem('${KEYS.skin}');var a=localStorage.getItem('${KEYS.accent}');if(s){s=s.toLowerCase();d.setAttribute('data-skin',s);d.setAttribute('data-theme',s==='private'?'private':'apple');}if(a){d.setAttribute('data-accent',a.toLowerCase());}}catch(e){}})();`;

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private window) — preference just won't persist */
  }
}

interface ThemeContextValue {
  skin: Skin;
  accent: Accent;
  currency: DisplayCurrency;
  hidden: boolean;
  setSkin: (s: Skin) => void;
  setAccent: (a: Accent) => void;
  setCurrency: (c: DisplayCurrency) => void;
  setHidden: (h: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<Skin>('Apple');
  const [accent, setAccentState] = useState<Accent>('Teal');
  const [currency, setCurrencyState] = useState<DisplayCurrency>('INR');
  const [hidden, setHiddenState] = useState(false);

  // Hydrate saved preferences after mount (SSR renders the defaults).
  useEffect(() => {
    setSkinState(read(KEYS.skin, SKINS, 'Apple'));
    setAccentState(read(KEYS.accent, ACCENTS, 'Teal'));
    setCurrencyState(read(KEYS.currency, ['INR', 'NPR'] as const, 'INR'));
    setHiddenState(read(KEYS.hidden, ['1', '0'] as const, '0') === '1');
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('data-skin', skin.toLowerCase());
    el.setAttribute('data-theme', skin === 'Private' ? 'private' : 'apple');
    el.setAttribute('data-accent', accent.toLowerCase());
  }, [skin, accent]);

  const setSkin = useCallback((s: Skin) => {
    setSkinState(s);
    write(KEYS.skin, s);
  }, []);
  const setAccent = useCallback((a: Accent) => {
    setAccentState(a);
    write(KEYS.accent, a);
  }, []);
  const setCurrency = useCallback((c: DisplayCurrency) => {
    setCurrencyState(c);
    write(KEYS.currency, c);
  }, []);
  const setHidden = useCallback((h: boolean) => {
    setHiddenState(h);
    write(KEYS.hidden, h ? '1' : '0');
  }, []);

  const value = useMemo(
    () => ({ skin, accent, currency, hidden, setSkin, setAccent, setCurrency, setHidden }),
    [skin, accent, currency, hidden, setSkin, setAccent, setCurrency, setHidden],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
