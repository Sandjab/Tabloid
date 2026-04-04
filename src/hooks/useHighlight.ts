import { useValidationHighlightStore } from '@/store/useValidationHighlightStore';

export function useTableHighlight(tableId: string): 'error' | 'warning' | null {
  return useValidationHighlightStore((s) => {
    const match = s.highlights.find(
      (h) => h.tableId === tableId && !h.columnId,
    );
    return match?.severity ?? null;
  });
}

export function useColumnHighlight(
  tableId: string,
  columnId: string,
): 'error' | 'warning' | null {
  return useValidationHighlightStore((s) => {
    const match = s.highlights.find(
      (h) => h.tableId === tableId && h.columnId === columnId,
    );
    return match?.severity ?? null;
  });
}
