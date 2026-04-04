import { useCallback, useMemo, useState } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { validateSchema, type ValidationWarning } from '@/utils/validate-schema';

const zoomSelector = (s: { transform: [number, number, number] }) =>
  Math.round(s.transform[2] * 100);

export default function StatusBar() {
  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);
  const nodes = useSchemaStore((s) => s.nodes);
  const onNodesChange = useSchemaStore((s) => s.onNodesChange);
  const zoom = useStore(zoomSelector);
  const { zoomTo, setCenter } = useReactFlow();
  const [expanded, setExpanded] = useState(false);

  const selectedCount = nodes.filter((n) => n.selected).length;

  const warnings = useMemo(
    () => validateSchema(tables, relations),
    [tables, relations],
  );

  const errorCount = warnings.filter((w) => w.severity === 'error').length;
  const warnCount = warnings.filter((w) => w.severity === 'warning').length;

  const handleZoomReset = useCallback(() => {
    zoomTo(1, { duration: 300 });
  }, [zoomTo]);

  const handleWarningClick = useCallback(
    (warning: ValidationWarning) => {
      const table = tables.find((t) => t.id === warning.tableId);
      if (table) {
        setCenter(table.position.x + 125, table.position.y + 50, {
          zoom: 1.2,
          duration: 400,
        });
        const { nodes: allNodes } = useSchemaStore.getState();
        onNodesChange(
          allNodes.map((n) => ({
            type: 'select' as const,
            id: n.id,
            selected: n.id === warning.tableId,
          })),
        );
      }
    },
    [tables, setCenter, onNodesChange],
  );

  return (
    <div className="relative" data-testid="status-bar-container">
      {/* Expanded validation list */}
      {expanded && warnings.length > 0 && (
        <div
          className="absolute bottom-full left-0 mb-px max-h-48 w-80 overflow-y-auto rounded-t-md border border-b-0 border-border bg-popover shadow-sm"
          data-testid="validation-panel"
        >
          {warnings.map((w, i) => (
            <button
              key={`${w.type}-${w.tableId}-${i}`}
              className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
              onClick={() => handleWarningClick(w)}
              data-testid={`warning-${w.type}-${i}`}
            >
              <span className={w.severity === 'error' ? 'text-destructive' : 'text-yellow-500'}>
                {w.severity === 'error' ? '●' : '▲'}
              </span>
              <span className="text-foreground">{w.message}</span>
            </button>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div
        className="flex h-6 items-center justify-between border-t border-border bg-background px-3 text-[10px] text-muted-foreground"
        data-testid="status-bar"
      >
        <div className="flex items-center gap-3">
          <span>{tables.length} table{tables.length !== 1 ? 's' : ''}</span>
          {selectedCount > 0 && (
            <span>{selectedCount} selected</span>
          )}
          {warnings.length > 0 && (
            <button
              className="flex items-center gap-1.5 transition-colors hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
              data-testid="validation-toggle"
            >
              {errorCount > 0 && (
                <span className="animate-badge-pulse text-destructive">
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {warnCount > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  {warnCount} warning{warnCount !== 1 ? 's' : ''}
                </span>
              )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            className="transition-colors hover:text-foreground"
            onClick={handleZoomReset}
            title="Click to reset zoom to 100%"
            data-testid="zoom-indicator"
          >
            {zoom}%
          </button>
          <span className="text-muted-foreground/50">Proudly clauded by JP GAVINI 04/2026</span>
        </div>
      </div>
    </div>
  );
}
