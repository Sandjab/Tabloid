import { useMemo } from 'react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { validateSchema } from '@/utils/validate-schema';

function useValidationWarnings() {
  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);
  const dialect = useSchemaStore((s) => s.dialect);
  return useMemo(() => validateSchema(tables, relations, dialect), [tables, relations, dialect]);
}

export function useTableHighlight(tableId: string): 'error' | 'warning' | null {
  const warnings = useValidationWarnings();
  return useMemo(() => {
    let severity: 'error' | 'warning' | null = null;
    for (const w of warnings) {
      if (w.tableId === tableId && !w.columnId) {
        if (w.severity === 'error') return 'error';
        severity = 'warning';
      }
    }
    return severity;
  }, [warnings, tableId]);
}

export function useColumnHighlight(
  tableId: string,
  columnId: string,
): 'error' | 'warning' | null {
  const warnings = useValidationWarnings();
  return useMemo(() => {
    let severity: 'error' | 'warning' | null = null;
    for (const w of warnings) {
      if (w.tableId === tableId && w.columnId === columnId) {
        if (w.severity === 'error') return 'error';
        severity = 'warning';
      }
    }
    return severity;
  }, [warnings, tableId, columnId]);
}
