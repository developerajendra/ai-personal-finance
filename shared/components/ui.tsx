'use client';

/**
 * Personal Finance UI kit — the shared building blocks from the v7 design.
 * Every screen composes these instead of repeating markup; colours, radii and
 * shadows all come from the theme tokens (see app/theme.css).
 */

import Link from 'next/link';
import { forwardRef, useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronRight, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { fmtDay, useMoney } from '@/shared/hooks/useMoney';

/* ------------------------------------------------------------------ Panel */

type PanelProps = HTMLAttributes<HTMLElement> & { lift?: boolean; flush?: boolean; as?: 'section' | 'div' | 'article' };

/** White rounded surface (radius 18, hairline shadow). `flush` removes padding for edge-to-edge tables. */
export function Panel({ lift, flush, as: Tag = 'section', className, children, ...rest }: PanelProps) {
  return (
    <Tag className={cn('panel', !flush && 'px-6 py-[22px]', lift && 'panel-lift', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[19px] leading-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-[13.5px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-none items-center gap-2">{action}</div>}
    </div>
  );
}

/** Small accent text link used in panel headers ("Portfolio", "Calendar", "Manage connections"). */
export function PanelLink({ href, children, onClick }: { href?: string; children: ReactNode; onClick?: () => void }) {
  const cls = 'rounded-md px-2 py-1 text-[14px] font-medium text-accent-700 hover:bg-accent-100';
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- Button */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const btnClass = (variant: Variant, size: Size, iconOnly?: boolean, className?: string) =>
  cn('btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, iconOnly && 'btn-icon', className);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconOnly?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconOnly, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={btnClass(variant, size, iconOnly, className)} {...rest}>
      {Icon && <Icon className="h-4 w-4 flex-none" strokeWidth={1.9} />}
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={btnClass(variant, size, false, className)}>
      {Icon && <Icon className="h-4 w-4 flex-none" strokeWidth={1.9} />}
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------ Segmented */

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: readonly (SegOption<T> | T)[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn('seg', className)} role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return (
          <button key={opt.value} type="button" className="seg-opt" aria-pressed={opt.value === value} onClick={() => onChange(opt.value)}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- UnderlineTabs */

export interface TabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  count?: number | string;
  /** When set the tab is a route link instead of local state */
  href?: string;
}

/** Underline tab bar with optional count badges (Portfolio management, Loans). */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  trailing,
}: {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange?: (v: T) => void;
  className?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className={cn('flex items-end gap-6 overflow-x-auto border-b border-divider scrollbar-none', className)} role="tablist">
      {tabs.map((t) => {
        const on = t.value === value;
        const inner = (
          <>
            {t.label}
            {t.count !== undefined && t.count !== '' && (
              <span
                className={cn(
                  'ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11.5px] font-semibold leading-5',
                  on ? 'bg-accent-100 text-accent-800' : 'bg-tile text-muted',
                )}>
                {t.count}
              </span>
            )}
          </>
        );
        const cls = cn(
          '-mb-px flex flex-none items-center whitespace-nowrap border-b-2 pb-3 pt-1 text-[15px] transition-colors',
          on ? 'border-accent font-semibold text-accent-800' : 'border-transparent text-ink hover:text-accent-700',
        );
        return t.href ? (
          <Link key={t.value} href={t.href} role="tab" aria-selected={on} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={t.value} type="button" role="tab" aria-selected={on} className={cls} onClick={() => onChange?.(t.value)}>
            {inner}
          </button>
        );
      })}
      {trailing && <div className="-mb-px flex flex-none items-center pb-3">{trailing}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------- Tag */

export type Tone = 'neutral' | 'gain' | 'loss' | 'warn' | 'accent';

export function Tag({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cn('tag', tone !== 'neutral' && `tag-${tone}`, className)}>{children}</span>;
}

/** Status line with a leading dot: "● Not connected" */
export function StatusDot({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const color = { neutral: 'text-muted', gain: 'text-gain', loss: 'text-loss', warn: 'text-warn', accent: 'text-accent-700' }[tone];
  return (
    <span className={cn('inline-flex flex-none items-center gap-1.5 whitespace-nowrap text-[13px]', color)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export const toneText: Record<Tone | 'muted', string> = {
  neutral: 'text-ink',
  muted: 'text-muted',
  gain: 'text-gain',
  loss: 'text-loss',
  warn: 'text-warn',
  accent: 'text-accent-700',
};

/* ----------------------------------------------------------------- Amount */

/**
 * Sign colour rule (applies in every theme):
 *   positive → gain (green), negative → loss (red), zero → muted.
 * The exact shades come from the active skin's --fin-gain / --fin-loss tokens
 * (e.g. #1d8a3a / #d70015 in Light, #30d158 / #ff453a in Midnight), never the accent.
 */
export const signClass = (value: number | null | undefined) =>
  value == null || Math.abs(value) < 0.005 ? 'text-muted' : value > 0 ? 'text-gain' : 'text-loss';

/** Signed money amount (+₹1,200 / −₹1,200) coloured by its sign. */
export function Amount({
  value,
  dec = 0,
  compact,
  arrow,
  className,
}: {
  value: number;
  dec?: number;
  compact?: boolean;
  /** prefix ▲ / ▼ */
  arrow?: boolean;
  className?: string;
}) {
  const { S } = useMoney();
  return (
    <span className={cn('tabular-nums', signClass(value), className)}>
      {arrow && Math.abs(value) >= 0.005 ? (value > 0 ? '▲ ' : '▼ ') : ''}
      {S(value, { dec, compact })}
    </span>
  );
}

/* ------------------------------------------------------------- PageHeader */

export interface Crumb {
  label: string;
  href?: string;
}

export interface HeroMeta {
  label: string;
  value: ReactNode;
  tone?: Tone | 'muted';
}

/**
 * Page header from the design: breadcrumbs + primary action on one row, then the h1.
 * With `hero`, the title shrinks and a large figure with metadata columns follows
 * (Portfolio, asset classes, Upcoming).
 */
export function PageHeader({
  crumbs,
  title,
  actions,
  meta,
  hero,
  className,
}: {
  crumbs?: Crumb[];
  title: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode | false;
  hero?: { value: ReactNode; metas?: HeroMeta[]; tone?: Tone | 'muted' };
  className?: string;
}) {
  const metaNode = meta === false ? null : meta ?? <span>{fmtDay()}</span>;
  // crumbs={[]} with no actions drops the breadcrumb row (the title already says where you are)
  const showTopRow = !(crumbs && crumbs.length === 0 && !actions);
  return (
    <header className={cn('mb-8', className)}>
      {showTopRow && (
      <div className="flex min-h-[40px] flex-wrap items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[14px] text-muted">
          {(crumbs ?? [{ label: typeof title === 'string' ? title : '' }]).map((c, i, arr) => (
            <span key={i} className="flex items-center gap-1.5">
              {c.href && i < arr.length - 1 ? (
                <Link href={c.href} className="hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span className={i === arr.length - 1 ? 'text-ink' : undefined}>{c.label}</span>
              )}
              {i < arr.length - 1 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            </span>
          ))}
        </nav>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      )}

      {hero ? (
        <div className={cn('flex flex-wrap items-end justify-between gap-4', showTopRow && 'mt-5')}>
          <div className="min-w-0">
            <h1 className="text-[22px] leading-tight text-ink">{title}</h1>
            <div className={cn('mt-1 text-[clamp(40px,5.4vw,64px)] font-bold leading-[1.05] tracking-[-0.035em]', toneText[hero.tone ?? 'neutral'])}>
              {hero.value}
            </div>
            {hero.metas && hero.metas.length > 0 && (
              <dl className="mt-5 flex flex-wrap gap-x-9 gap-y-3">
                {hero.metas.map((m) => (
                  <div key={m.label}>
                    <dt className="eyebrow">{m.label}</dt>
                    <dd className={cn('mt-1.5 text-[15px]', toneText[m.tone ?? 'neutral'])}>{m.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          {metaNode && <p className="pb-1 text-[13px] text-muted">{metaNode}</p>}
        </div>
      ) : (
        <div className={cn('flex flex-wrap items-end justify-between gap-3', showTopRow && 'mt-5')}>
          <h1 className="text-[clamp(30px,3.4vw,40px)] leading-[1.1] text-ink">{title}</h1>
          {metaNode && <p className="pb-1.5 text-[13px] text-muted">{metaNode}</p>}
        </div>
      )}
    </header>
  );
}

/* ----------------------------------------------------------------- Metric */

/** Label · big value · sub line. Used in stat cards and summary rows. */
export function Metric({
  label,
  value,
  sub,
  tone = 'neutral',
  subTone = 'muted',
  size = 'md',
  eyebrow,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone | 'muted';
  subTone?: Tone | 'muted';
  size?: 'sm' | 'md' | 'lg';
  eyebrow?: boolean;
}) {
  const valueSize = { sm: 'text-[19px]', md: 'text-[22px]', lg: 'text-[26px]' }[size];
  return (
    <div className="min-w-0">
      <div className={eyebrow ? 'eyebrow' : 'text-[13.5px] text-muted'}>{label}</div>
      <div className={cn('mt-2 font-bold leading-tight tracking-[-0.02em]', valueSize, toneText[tone])}>{value}</div>
      {sub && <div className={cn('mt-2 text-[13px]', toneText[subTone])}>{sub}</div>}
    </div>
  );
}

/** Rounded square icon tile (28px) used on class cards and list rows. */
export function IconTile({ icon: Icon, color, size = 28, className }: { icon: LucideIcon; color?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex flex-none items-center justify-center rounded-[8px] bg-tile', className)}
      style={{ width: size, height: size, color: color ?? 'var(--color-text)' }}>
      <Icon style={{ width: size * 0.57, height: size * 0.57 }} strokeWidth={1.75} />
    </span>
  );
}

/* ------------------------------------------------------------------- Bars */

export function Dot({ color, size = 8, className }: { color: string; size?: number; className?: string }) {
  return <span aria-hidden className={cn('inline-block flex-none rounded-[2px]', className)} style={{ width: size, height: size, background: color }} />;
}

/** Thin share bar (3px) — percentage of total in a class colour. */
export function ShareBar({ value, color, height = 3, className, track }: { value: number; color: string; height?: number; className?: string; track?: string }) {
  return (
    <div className={cn('w-full overflow-hidden rounded-full', !track && 'bg-neutral-200', className)} style={{ height, background: track }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

/** Horizontal stacked bar (liquidity ladder, sidebar portfolio strip). */
export function StackBar({
  segments,
  height = 10,
  gap = 2,
  className,
}: {
  segments: { value: number; color: string; label?: string }[];
  height?: number;
  gap?: number;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  return (
    <div className={cn('flex w-full overflow-hidden rounded-full', className)} style={{ height, gap }}>
      {segments
        .filter((s) => s.value > 0)
        .map((s, i) => (
          <div key={i} title={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Misc */

export function Avatar({ name, size = 32, className }: { name?: string | null; size?: number; className?: string }) {
  const initials = (name || 'You')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <span
      className={cn('inline-flex flex-none items-center justify-center rounded-full bg-[var(--logo-bg)] font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 py-6">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {children && <p className="max-w-prose text-[14px] text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Placeholder label for screens that run on sample data until a backend exists. */
export function MockBadge({ children = 'Sample data' }: { children?: ReactNode }) {
  return (
    <Tag tone="warn" className="uppercase tracking-wide">
      {children}
    </Tag>
  );
}

/** Small skeleton line for loading states */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-neutral-200', className)} />;
}

/* ----------------------------------------------------------------- Drawer */

/** Right-side detail sheet (row click → details, forms open inside). */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 460,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside
        className="absolute bottom-0 right-0 top-0 flex max-w-full flex-col bg-panel shadow-lg"
        style={{ width }}>
        <div className="flex items-start justify-between gap-3 border-b border-divider px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-[19px] text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <Button variant="secondary" iconOnly icon={X} aria-label="Close" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-divider px-6 py-4">{footer}</div>}
      </aside>
    </div>
  );
}

/** Key / value row used inside drawers and detail panels */
export function DetailRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-divider py-3 text-[14px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}
