import { useMemo, useState } from 'react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { suggestForeignKeys, type FkSuggestion } from '@/utils/ai/suggest-fks';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link2 } from 'lucide-react';

export default function SuggestFksTab() {
  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);
  const addRelation = useSchemaStore((s) => s.addRelation);

  const suggestions = useMemo(() => suggestForeignKeys(tables, relations), [tables, relations]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const suggestionKey = (s: FkSuggestion) => `${s.sourceTableId}:${s.sourceColumnId}`;

  const applySelected = () => {
    let applied = 0;
    for (const s of suggestions) {
      if (!selected.has(suggestionKey(s))) continue;
      addRelation(
        s.sourceTableId,
        s.sourceColumnId,
        s.targetTableId,
        s.targetColumnId,
        'many-to-one',
      );
      applied++;
    }
    if (applied > 0) {
      toast.success(`Added ${applied} relation${applied === 1 ? '' : 's'}`);
      setSelected(new Set());
    }
  };

  const selectAll = () => {
    setSelected(new Set(suggestions.map(suggestionKey)));
  };

  if (suggestions.length === 0) {
    return (
      <div
        className="rounded-md bg-muted px-3 py-4 text-center text-sm text-muted-foreground"
        data-testid="suggest-fks-empty"
      >
        No FK suggestions — all candidate columns are either already FKs or don't match a target table
        by name.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Detected by scanning column names (<code>*_id</code>, <code>*Id</code>, <code>fk_*</code>) against table
        names. Runs locally — no API calls.
      </p>

      <div className="flex gap-2">
        <Button
          size="xs"
          variant="outline"
          onClick={selectAll}
          disabled={selected.size === suggestions.length}
          data-testid="suggest-fks-select-all"
        >
          Select all
        </Button>
        <Button
          size="xs"
          onClick={applySelected}
          disabled={selected.size === 0}
          data-testid="suggest-fks-apply"
        >
          <Link2 className="mr-1 size-3.5" /> Apply {selected.size} selected
        </Button>
      </div>

      <ul className="space-y-1" data-testid="suggest-fks-list">
        {suggestions.map((s) => {
          const key = suggestionKey(s);
          const checked = selected.has(key);
          return (
            <li
              key={key}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(key)}
                data-testid={`suggest-fks-check-${key}`}
              />
              <div className="min-w-0 flex-1 font-mono text-xs">
                {s.sourceTableName}.<strong>{s.sourceColumnName}</strong> →{' '}
                {s.targetTableName}.<strong>{s.targetColumnName}</strong>
              </div>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  s.confidence === 'high'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                }`}
              >
                {s.confidence}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
