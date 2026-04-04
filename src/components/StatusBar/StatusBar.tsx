import { useCallback } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';

const zoomSelector = (s: { transform: [number, number, number] }) =>
  Math.round(s.transform[2] * 100);

export default function StatusBar() {
  const tables = useSchemaStore((s) => s.tables);
  const nodes = useSchemaStore((s) => s.nodes);
  const zoom = useStore(zoomSelector);
  const { zoomTo } = useReactFlow();

  const selectedCount = nodes.filter((n) => n.selected).length;

  const handleZoomReset = useCallback(() => {
    zoomTo(1, { duration: 300 });
  }, [zoomTo]);

  return (
    <div
      className="flex h-6 items-center justify-between border-t border-border bg-background px-3 text-[10px] text-muted-foreground"
      data-testid="status-bar"
    >
      <div className="flex items-center gap-3">
        <span>{tables.length} table{tables.length !== 1 ? 's' : ''}</span>
        {selectedCount > 0 && (
          <span>{selectedCount} selected</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          className="hover:text-foreground transition-colors"
          onClick={handleZoomReset}
          title="Click to reset zoom to 100%"
          data-testid="zoom-indicator"
        >
          {zoom}%
        </button>
        <span className="text-muted-foreground/50">Proudly clauded by JP GAVINI 04/2026</span>
      </div>
    </div>
  );
}
