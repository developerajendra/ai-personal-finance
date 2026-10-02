'use client';

import { Check } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { ACCENTS, ACCENT_SWATCH, useTheme, type Skin } from '@/shared/providers/ThemeProvider';

const DESIGNS: { value: Skin; label: string; bg: string; card: string }[] = [
  { value: 'Apple', label: 'Light', bg: '#f5f5f7', card: '#ffffff' },
  { value: 'Midnight', label: 'Midnight', bg: '#111113', card: '#2c2c2e' },
  { value: 'Sand', label: 'Sand', bg: '#f4efe8', card: '#fffdf9' },
  { value: 'Mint', label: 'Mint', bg: '#eef4f2', card: '#ffffff' },
  { value: 'Private', label: 'Private bank', bg: '#0b2340', card: '#f6f4f0' },
];

/** Design (skin) tiles + colour (accent) swatches, as in the design's Appearance sheet. */
export function AppearancePicker({ compact }: { compact?: boolean }) {
  const { skin, accent, setSkin, setAccent } = useTheme();
  const label = 'mb-2.5 mt-1 block text-[12px] font-semibold uppercase tracking-[0.04em] text-neutral-700';
  return (
    <div>
      <span className={label}>Design</span>
      <div className={cn('grid gap-2.5', compact ? 'grid-cols-3' : 'grid-cols-[repeat(auto-fill,minmax(96px,1fr))]')}>
        {DESIGNS.map((d) => {
          const on = skin === d.value;
          return (
            <button
              key={d.value}
              type="button"
              aria-pressed={on}
              onClick={() => setSkin(d.value)}
              className={cn('flex flex-col gap-2 rounded-[14px] p-2 text-left text-[13px] font-semibold', on ? 'border-2 border-accent' : 'border border-divider')}>
              <span className="flex h-[54px] items-end gap-1 rounded-[9px] p-1.5 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)]" style={{ background: d.bg }}>
                <span className="h-[60%] flex-1 rounded-[5px]" style={{ background: d.card }} />
                <span className="h-[85%] flex-1 rounded-[5px]" style={{ background: d.card }} />
              </span>
              {d.label}
            </button>
          );
        })}
      </div>
      <span className={cn(label, 'mt-5')}>Colour</span>
      <div className="flex flex-wrap gap-3.5">
        {ACCENTS.map((a) => {
          const on = accent === a;
          const c = ACCENT_SWATCH[a];
          return (
            <button key={a} type="button" aria-pressed={on} aria-label={a} title={a} onClick={() => setAccent(a)} className="flex flex-col items-center gap-1.5 text-[11.5px]">
              <span
                className="grid h-10 w-10 place-items-center rounded-full text-white"
                style={{ background: c, boxShadow: on ? `0 0 0 2px var(--panel-bg), 0 0 0 4px ${c}` : 'none' }}>
                {on && <Check className="h-[18px] w-[18px]" />}
              </span>
              {a}
            </button>
          );
        })}
      </div>
    </div>
  );
}
