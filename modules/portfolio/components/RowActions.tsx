'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, Edit2, MoreVertical, Trash2, Upload, type LucideIcon } from 'lucide-react';

export interface RowMenuItem {
  label: ReactNode;
  icon: LucideIcon;
  onClick: () => void;
  tone?: 'default' | 'gain' | 'danger';
  disabled?: boolean;
}

const TONE: Record<NonNullable<RowMenuItem['tone']>, string> = {
  default: 'text-ink hover:bg-tile',
  gain: 'text-gain hover:bg-gain-bg',
  danger: 'text-loss hover:bg-loss-bg',
};

/**
 * Three-dots menu for a table row. The menu is fixed-positioned so it isn't clipped by
 * scrolling table containers; clicks never reach the row (which opens the detail drawer).
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const toggle = () => {
    if (pos) return setPos(null);
    const r = buttonRef.current!.getBoundingClientRect();
    // Open upwards when the row is near the bottom of the viewport
    const menuHeight = items.length * 40 + 8;
    const top = r.bottom + menuHeight > window.innerHeight ? Math.max(8, r.top - menuHeight - 4) : r.bottom + 4;
    setPos({ top, right: window.innerWidth - r.right });
  };

  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        className="rounded-md p-1.5 text-muted hover:bg-tile hover:text-ink"
        title={`Actions for ${label}`}
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={!!pos}>
        <MoreVertical className="h-4 w-4" />
      </button>
      {pos && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[70] min-w-[176px] overflow-hidden rounded-md border border-divider bg-panel py-1 shadow-lg"
          style={{ top: pos.top, right: pos.right }}>
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setPos(null);
                item.onClick();
              }}
              className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${TONE[item.tone ?? 'default']}`}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Edit / publish toggle / delete for a table row, inside a three-dots menu. */
export function RowActions({
  label,
  onEdit,
  onDelete,
  isPublished,
  onTogglePublish,
  extra = [],
}: {
  label: string;
  onEdit?: () => void;
  onDelete: () => void;
  /** With onTogglePublish, adds "Publish" / "Move to draft" */
  isPublished?: boolean;
  onTogglePublish?: () => void;
  /** Row-specific items, shown between publish and delete */
  extra?: RowMenuItem[];
}) {
  const items: RowMenuItem[] = [
    ...(onEdit ? [{ label: 'Edit', icon: Edit2, onClick: onEdit }] : []),
    ...(onTogglePublish
      ? [{ label: isPublished ? 'Move to draft' : 'Publish', icon: isPublished ? Download : Upload, onClick: onTogglePublish, tone: isPublished ? 'default' : 'gain' } as RowMenuItem]
      : []),
    ...extra,
    { label: 'Delete', icon: Trash2, onClick: onDelete, tone: 'danger' },
  ];
  return <RowMenu label={label} items={items} />;
}
