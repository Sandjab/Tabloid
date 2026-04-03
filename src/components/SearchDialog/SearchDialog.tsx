import { useState, useMemo, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';

interface SearchDialogProps {
  onClose: () => void;
}

interface SearchResult {
  tableId: string;
  tableName: string;
  columnName?: string;
}

export default function SearchDialog({ onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const tables = useSchemaStore((s) => s.tables);
  const onNodesChange = useSchemaStore((s) => s.onNodesChange);
  const { setCenter } = useReactFlow();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      data-testid="search-dialog-backdrop"
    >
      <div
        className="absolute left-1/2 top-24 w-96 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-600 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        data-testid="search-dialog"
      >
        <input
          ref={inputRef}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          placeholder="Search tables and columns..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && results.length > 0) handleSelect(results[0]);
          }}
          data-testid="search-input"
        />
        {results.length > 0 && (
          <div className="mt-2 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={`${r.tableId}-${r.columnName ?? ''}-${i}`}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSelect(r)}
                data-testid={`search-result-${i}`}
              >
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {r.tableName}
                </span>
                {r.columnName && (
                  <>
                    <span className="text-gray-400">.</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {r.columnName}
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="mt-2 px-2 py-1.5 text-sm text-gray-400 italic">
            No results
          </div>
        )}
      </div>
    </div>
  );
}
