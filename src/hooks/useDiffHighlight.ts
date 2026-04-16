import { useMemo } from 'react';
import { useDiff } from '@/hooks/useDiff';

export type DiffTableStatus = 'added' | 'modified' | null;
export type DiffColumnStatus = 'added' | 'modified' | null;

export function useDiffTableHighlight(tableId: string): DiffTableStatus {
  const diff = useDiff();
  return useMemo(() => {
    if (!diff) return null;
    if (diff.tables.added.some((t) => t.id === tableId)) return 'added';
    if (diff.tables.modified.some((td) => td.current.id === tableId)) return 'modified';
    return null;
  }, [diff, tableId]);
}

export function useDiffColumnHighlight(
  tableId: string,
  columnId: string,
): DiffColumnStatus {
  const diff = useDiff();
  return useMemo(() => {
    if (!diff) return null;

    // An added table's columns all count as "added" too, but TableNode already
    // paints the table; column-level highlight is redundant there.
    if (diff.tables.added.some((t) => t.id === tableId)) return null;

    const td = diff.tables.modified.find((m) => m.current.id === tableId);
    if (!td) return null;

    if (td.columns.added.some((c) => c.id === columnId)) return 'added';
    if (td.columns.modified.some((cd) => cd.current.id === columnId)) return 'modified';
    return null;
  }, [diff, tableId, columnId]);
}
