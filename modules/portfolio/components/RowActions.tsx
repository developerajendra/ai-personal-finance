'use client';

import { Edit2, Trash2 } from 'lucide-react';

/** Compact edit / delete icon buttons for a table row (clicks don't open the row drawer). */
export function RowActions({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={onEdit} className="rounded-md p-1.5 text-muted hover:bg-accent-100 hover:text-accent-700" title={`Edit ${label}`} aria-label={`Edit ${label}`}>
        <Edit2 className="h-4 w-4" />
      </button>
      <button type="button" onClick={onDelete} className="rounded-md p-1.5 text-muted hover:bg-loss-bg hover:text-loss" title={`Delete ${label}`} aria-label={`Delete ${label}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
