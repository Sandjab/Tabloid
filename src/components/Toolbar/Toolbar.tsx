import { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useTheme } from '@/hooks/useTheme';
import { computeAutoLayout } from '@/utils/auto-layout';
import { importJSON } from '@/utils/import-json';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Undo2,
  Redo2,
  LayoutGrid,
  Download,
  Upload,
  Search,
  Moon,
  Sun,
} from 'lucide-react';

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

  return (
    <div
      className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-lg bg-popover p-1 shadow-sm ring-1 ring-border"
      data-testid="toolbar"
    >
      <Button
        size="sm"
        onClick={handleAddTable}
        data-testid="add-table-btn"
        title="Add Table"
      >
        <Plus className="size-3.5" />
        Table
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        data-testid="undo-btn"
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        data-testid="redo-btn"
      >
        <Redo2 />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <Button
        variant="ghost"
        size="sm"
        onClick={handleAutoLayout}
        title="Auto-arrange tables"
        data-testid="auto-layout-btn"
      >
        <LayoutGrid className="size-3.5" />
        Layout
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <Button
        variant="ghost"
        size="sm"
        onClick={onExportOpen}
        title="Export schema"
        data-testid="export-btn"
      >
        <Download className="size-3.5" />
        Export
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleImport}
        title="Import .tabloid.json"
        data-testid="import-btn"
      >
        <Upload className="size-3.5" />
        Import
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.tabloid.json"
        className="hidden"
        onChange={handleFileChange}
        data-testid="import-file-input"
      />

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onSearchOpen}
        title="Search (Ctrl+F)"
        data-testid="search-btn"
      >
        <Search />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleTheme}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        data-testid="theme-toggle-btn"
      >
        {theme === 'light' ? <Moon /> : <Sun />}
      </Button>
    </div>
  );
}
