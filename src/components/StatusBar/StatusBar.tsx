import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { validateSchema, type ValidationWarning } from '@/utils/validate-schema';

const zoomSelector = (s: { transform: [number, number, number] }) =>
  Math.round(s.transform[2] * 100);

const SEVERITY_ICON = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const SEVERITY_TONE = {
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
} as const;

export default function StatusBar() {
  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);
  const dialect = useSchemaStore((s) => s.dialect);
  const nodes = useSchemaStore((s) => s.nodes);
  const onNodesChange = useSchemaStore((s) => s.onNodesChange);
  const zoom = useStore(zoomSelector);
  const { zoomTo, setCenter } = useReactFlow();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [expanded]);

  const selectedCount = nodes.filter((n) => n.selected).length;

  const warnings = useMemo(
    () => validateSchema(tables, relations, dialect),
    [tables, relations, dialect],
  );

  const errors = warnings.filter((w) => w.severity === 'error');
  const warns = warnings.filter((w) => w.severity === 'warning');
  const errorCount = errors.length;
  const warnCount = warns.length;
  // Inline preview shows only actionable issues (errors > warnings); info hints live in the popover.
  const topWarning = errors[0] ?? warns[0];

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
    <div ref={containerRef} className="relative" data-testid="status-bar-container">
      {/* Expanded validation list */}
      {expanded && warnings.length > 0 && (
        <div
          className="absolute bottom-full left-0 mb-px max-h-48 w-80 overflow-y-auto rounded-t-md border border-b-0 border-border bg-popover shadow-sm"
          data-testid="validation-panel"
        >
          {warnings.map((w, i) => {
            const Icon = SEVERITY_ICON[w.severity];
            return (
              <button
                key={`${w.type}-${w.tableId}-${i}`}
                className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                onClick={() => { handleWarningClick(w); setExpanded(false); }}
                data-testid={`warning-${w.type}-${i}`}
              >
                <Icon className={`mt-0.5 size-3.5 shrink-0 ${SEVERITY_TONE[w.severity]}`} />
                <span className="text-foreground">{w.message}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Status bar */}
      <div
        className="flex h-7 items-center justify-between border-t border-border bg-background px-3 text-xs text-muted-foreground"
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
                <span className="animate-badge-pulse rounded bg-destructive/10 px-1.5 text-destructive">
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {warnCount > 0 && (
                <span className="rounded bg-yellow-100 px-1.5 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                  {warnCount} warning{warnCount !== 1 ? 's' : ''}
                </span>
              )}
            </button>
          )}
          {topWarning && (
            <button
              className="max-w-[280px] truncate text-foreground/60 transition-colors hover:text-foreground"
              onClick={() => handleWarningClick(topWarning)}
              title={topWarning.message}
              data-testid="top-warning-inline"
            >
              {topWarning.message}
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
          <span className="text-muted-foreground/70">Proudly clauded by JP GAVINI 04/2026</span>
        </div>
      </div>
    </div>
  );
}
