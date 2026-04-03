import { useMemo, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { validateSchema } from '@/utils/validate-schema';

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

  const handleWarningClick = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
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
          selected: n.id === tableId,
        })),
      );
    }
  };

  const errorCount = warnings.filter((w) => w.severity === 'error').length;
  const warnCount = warnings.filter((w) => w.severity === 'warning').length;

  return (
    <div
      className="absolute bottom-4 left-4 z-10 max-w-sm rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800"
      data-testid="validation-panel"
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium"
        onClick={() => setCollapsed(!collapsed)}
        data-testid="validation-toggle"
      >
        {errorCount > 0 && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700 dark:bg-red-900 dark:text-red-300">
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {warnCount > 0 && (
          <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
            {warnCount} warning{warnCount !== 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto text-gray-400">{collapsed ? '▲' : '▼'}</span>
      </button>
      {!collapsed && (
        <div className="max-h-48 overflow-y-auto border-t border-gray-200 dark:border-gray-600">
          {warnings.map((w, i) => (
            <button
              key={`${w.type}-${w.tableId}-${i}`}
              className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => handleWarningClick(w.tableId)}
              data-testid={`warning-${w.type}-${i}`}
            >
              <span className={w.severity === 'error' ? 'text-red-500' : 'text-yellow-500'}>
                {w.severity === 'error' ? '●' : '▲'}
              </span>
              <span className="text-gray-700 dark:text-gray-300">{w.message}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
