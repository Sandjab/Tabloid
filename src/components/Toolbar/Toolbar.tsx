import { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useTheme } from '@/hooks/useTheme';
import { computeAutoLayout } from '@/utils/auto-layout';
import { importJSON } from '@/utils/import-json';

interface ToolbarProps {
  onSearchOpen: () => void;
  onExportOpen: () => void;
}

export default function Toolbar({ onSearchOpen, onExportOpen }: ToolbarProps) {
  const addTable = useSchemaStore((s) => s.addTable);
  const loadSchema = useSchemaStore((s) => s.loadSchema);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddTable = useCallback(() => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    addTable(position);
  }, [addTable, screenToFlowPosition]);

  const handleAutoLayout = useCallback(() => {
    const { tables, relations, updateTablePositions } = useSchemaStore.getState();
    if (tables.length === 0) return;
    const positions = computeAutoLayout(tables, relations);
    updateTablePositions(positions);
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const { tables, relations } = importJSON(reader.result as string);
          loadSchema(tables, relations);
          fitView({ padding: 0.2, duration: 300 });
        } catch (err) {
          alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [loadSchema, fitView],
  );

  const btnClass =
    'rounded px-2.5 py-1.5 text-sm font-medium transition-colors';
  const btnDefault =
    `${btnClass} bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600`;
  const btnDisabled =
    `${btnClass} bg-gray-50 text-gray-300 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600`;

  return (
    <div
      className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-lg bg-white p-1.5 shadow-lg dark:bg-gray-800"
      data-testid="toolbar"
    >
      <button
        className={`${btnClass} bg-blue-500 text-white hover:bg-blue-600`}
        onClick={handleAddTable}
        data-testid="add-table-btn"
        title="Add Table"
      >
        + Table
      </button>

      <div className="mx-0.5 h-6 w-px bg-gray-200 dark:bg-gray-600" />

      <button
        className={canUndo ? btnDefault : btnDisabled}
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        data-testid="undo-btn"
      >
        ↶
      </button>
      <button
        className={canRedo ? btnDefault : btnDisabled}
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        data-testid="redo-btn"
      >
        ↷
      </button>

      <div className="mx-0.5 h-6 w-px bg-gray-200 dark:bg-gray-600" />

      <button
        className={btnDefault}
        onClick={handleAutoLayout}
        title="Auto-arrange tables"
        data-testid="auto-layout-btn"
      >
        ⊞ Layout
      </button>

      <div className="mx-0.5 h-6 w-px bg-gray-200 dark:bg-gray-600" />

      <button
        className={btnDefault}
        onClick={onExportOpen}
        title="Export schema"
        data-testid="export-btn"
      >
        ↓ Export
      </button>
      <button
        className={btnDefault}
        onClick={handleImport}
        title="Import .tabloid.json"
        data-testid="import-btn"
      >
        ↑ Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.tabloid.json"
        className="hidden"
        onChange={handleFileChange}
        data-testid="import-file-input"
      />

      <div className="mx-0.5 h-6 w-px bg-gray-200 dark:bg-gray-600" />

      <button
        className={btnDefault}
        onClick={onSearchOpen}
        title="Search (Ctrl+F)"
        data-testid="search-btn"
      >
        🔍
      </button>

      <button
        className={btnDefault}
        onClick={toggleTheme}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        data-testid="theme-toggle-btn"
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </div>
  );
}
