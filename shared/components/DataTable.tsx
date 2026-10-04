'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface Column<T> {
  key: string;
  label: ReactNode;
  /** right-align numbers; amount columns never truncate */
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
  /** enables sorting on this column */
  sortValue?: (row: T) => number | string;
  className?: string;
}

/**
 * Data table: grey uppercase header, hairline rows with hover tint, sortable headers,
 * optional row click (opens a detail drawer on class pages).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  defaultSort,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  className?: string;
}) {
  const [sort, setSort] = useState(defaultSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = col.sortValue!(a);
      const y = col.sortValue!(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [rows, columns, sort]);

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c, i) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  className={cn(c.align === 'right' && 'num', i === 0 && '!pl-6', i === columns.length - 1 && '!pr-6')}
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sortValue ? (
                    <button
                      type="button"
                      className={cn('inline-flex items-center gap-1 uppercase tracking-[inherit] hover:text-ink', active && 'text-ink')}
                      onClick={() =>
                        setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.align === 'right' ? 'desc' : 'asc' }))
                      }>
                      {c.label}
                      {active && (sort!.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="!py-10 text-center text-[14px] text-muted">
                {empty ?? 'Nothing to show yet.'}
              </td>
            </tr>
          ) : (
            sorted.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(r) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(onRowClick && 'cursor-pointer')}>
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(c.align === 'right' && 'num tabular-nums', i === 0 && '!pl-6 max-w-[280px] truncate', i === columns.length - 1 && '!pr-6', c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
