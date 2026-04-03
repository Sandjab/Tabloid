import { useState, useMemo, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  tableId: string;
  tableName: string;
  columnName?: string;
}

export default function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const tables = useSchemaStore((s) => s.tables);
  const onNodesChange = useSchemaStore((s) => s.onNodesChange);
  const { setCenter } = useReactFlow();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Small delay to let the dialog animate open before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    // Reset query when dialog closes
    setQuery('');
  }, [open]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const matches: SearchResult[] = [];
    for (const table of tables) {
      if (table.name.toLowerCase().includes(q)) {
        matches.push({ tableId: table.id, tableName: table.name });
      }
      for (const col of table.columns) {
        if (col.name.toLowerCase().includes(q)) {
          matches.push({
            tableId: table.id,
            tableName: table.name,
            columnName: col.name,
          });
        }
      }
    }
    return matches.slice(0, 20);
  }, [query, tables]);

  const handleSelect = (result: SearchResult) => {
    const table = tables.find((t) => t.id === result.tableId);
    if (table) {
      setCenter(table.position.x + 125, table.position.y + 50, {
        zoom: 1.2,
        duration: 400,
      });
      // Select the node
      const { nodes } = useSchemaStore.getState();
      onNodesChange(
        nodes.map((n) => ({
          type: 'select' as const,
          id: n.id,
          selected: n.id === result.tableId,
        })),
      );
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-24 -translate-y-0 sm:max-w-sm"
        data-testid="search-dialog"
      >
        <DialogTitle className="sr-only">Search tables and columns</DialogTitle>
        <Input
          ref={inputRef}
          placeholder="Search tables and columns..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) handleSelect(results[0]);
          }}
          data-testid="search-input"
        />
        {results.length > 0 && (
          <div className="max-h-64 overflow-y-auto -mx-1">
            {results.map((r, i) => (
              <button
                key={`${r.tableId}-${r.columnName ?? ''}-${i}`}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => handleSelect(r)}
                data-testid={`search-result-${i}`}
              >
                <span className="font-medium text-foreground">
                  {r.tableName}
                </span>
                {r.columnName && (
                  <>
                    <span className="text-muted-foreground">.</span>
                    <span className="text-muted-foreground">
                      {r.columnName}
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground italic">
            No results
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
