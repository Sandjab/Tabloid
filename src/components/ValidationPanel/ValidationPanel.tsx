import { useMemo, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { validateSchema, type ValidationWarning } from '@/utils/validate-schema';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function ValidationPanel() {
  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);
  const onNodesChange = useSchemaStore((s) => s.onNodesChange);
  const { setCenter } = useReactFlow();
  const [collapsed, setCollapsed] = useState(true);

  const warnings = useMemo(
    () => validateSchema(tables, relations),
    [tables, relations],
  );

  if (warnings.length === 0) return null;

  const handleWarningClick = (warning: ValidationWarning) => {
    const table = tables.find((t) => t.id === warning.tableId);
    if (table) {
      setCenter(table.position.x + 125, table.position.y + 50, {
        zoom: 1.2,
        duration: 400,
      });
      const { nodes } = useSchemaStore.getState();
      onNodesChange(
        nodes.map((n) => ({
          type: 'select' as const,
          id: n.id,
          selected: n.id === warning.tableId,
        })),
      );
    }
  };

  const errorCount = warnings.filter((w) => w.severity === 'error').length;
  const warnCount = warnings.filter((w) => w.severity === 'warning').length;

  return (
    <div
      className="absolute bottom-4 left-[46px] z-10 max-w-sm rounded-lg bg-popover shadow-sm ring-1 ring-border"
      data-testid="validation-panel"
    >
      <Button
        variant="ghost"
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium"
        onClick={() => setCollapsed(!collapsed)}
        data-testid="validation-toggle"
      >
        {errorCount > 0 && (
          <span className="animate-badge-pulse rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {warnCount > 0 && (
          <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
            {warnCount} warning{warnCount !== 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto">
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </span>
      </Button>
      {!collapsed && (
        <div className="max-h-48 overflow-y-auto border-t border-border">
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
    </div>
  );
}
