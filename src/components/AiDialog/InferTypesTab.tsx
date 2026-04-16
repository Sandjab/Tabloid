import { useMemo, useState } from 'react';
import { useApiKey } from '@/hooks/useApiKey';
import { useSchemaStore } from '@/store/useSchemaStore';
import { inferColumnTypes, listInferableColumns, type TypeSuggestion } from '@/utils/ai/infer-types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Wand2 } from 'lucide-react';

export default function InferTypesTab() {
  const { key, hasKey } = useApiKey();
  const tables = useSchemaStore((s) => s.tables);
  const updateColumnType = useSchemaStore((s) => s.updateColumnType);

  const inferable = useMemo(() => listInferableColumns(tables), [tables]);
  const columnToTable = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tables) for (const c of t.columns) map.set(c.id, t.id);
    return map;
  }, [tables]);

  const [suggestions, setSuggestions] = useState<TypeSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInfer = async () => {
    setError(null);
    setSuggestions([]);
    setLoading(true);
    try {
      const out = await inferColumnTypes(tables, key);
      setSuggestions(out);
      setSelected(new Set(out.map((s) => s.columnId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySelected = () => {
    let applied = 0;
    for (const s of suggestions) {
      if (!selected.has(s.columnId)) continue;
      const tableId = columnToTable.get(s.columnId);
      if (!tableId) continue;
      updateColumnType(tableId, s.columnId, s.suggestedType);
      applied++;
    }
    if (applied > 0) {
      toast.success(`Updated ${applied} column type${applied === 1 ? '' : 's'}`);
      setSuggestions([]);
      setSelected(new Set());
    }
  };

  if (inferable.length === 0) {
    return (
      <div
        className="rounded-md bg-muted px-3 py-4 text-center text-sm text-muted-foreground"
        data-testid="infer-types-empty"
      >
        No TEXT columns to infer — every column already has an intentional type.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Sends the names of {inferable.length} column{inferable.length === 1 ? '' : 's'} currently typed{' '}
        <code>TEXT</code> and asks Claude to suggest a better type based on the name.
      </p>

      <Button
        onClick={handleInfer}
        disabled={!hasKey || loading}
        data-testid="ai-infer-btn"
      >
        {loading ? (
          <>
            <Loader2 className="mr-1 size-3.5 animate-spin" /> Inferring…
          </>
        ) : (
          <>
            <Wand2 className="mr-1 size-3.5" /> Infer types
          </>
        )}
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <ul className="space-y-1" data-testid="infer-types-list">
            {suggestions.map((s) => (
              <li
                key={s.columnId}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.columnId)}
                  onChange={() => toggle(s.columnId)}
                  data-testid={`infer-types-check-${s.columnId}`}
                />
                <div className="min-w-0 flex-1 font-mono text-xs">
                  {s.tableName}.<strong>{s.columnName}</strong>: TEXT → {s.suggestedType}
                </div>
              </li>
            ))}
          </ul>

          <Button
            size="xs"
            onClick={applySelected}
            disabled={selected.size === 0}
            data-testid="infer-types-apply"
          >
            Apply {selected.size} selected
          </Button>
        </>
      )}
    </div>
  );
}
