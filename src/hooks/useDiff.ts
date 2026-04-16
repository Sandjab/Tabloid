import { useMemo } from 'react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useDiffStore } from '@/store/useDiffStore';
import { diffSchema } from '@/utils/diff-schema';
import type { SchemaDiff } from '@/types/diff';

export function useDiff(): SchemaDiff | null {
  const baseline = useDiffStore((s) => s.baseline);
  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);

  return useMemo(() => {
    if (!baseline) return null;
    return diffSchema(
      { tables: baseline.tables, relations: baseline.relations },
      { tables, relations },
      baseline.source,
    );
  }, [baseline, tables, relations]);
}
