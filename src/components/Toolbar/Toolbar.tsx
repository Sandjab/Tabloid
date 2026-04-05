import { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useTheme } from '@/hooks/useTheme';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { computeAutoLayout } from '@/utils/auto-layout';
import { importJSON } from '@/utils/import-json';
import { dedupName } from '@/utils/naming';
import { saveCurrentSchema, loadSchemaByName, renameStoredSchema, getRecentList } from '@/hooks/useAutoSave';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  ChevronDown,
  FilePlus2,
} from 'lucide-react';

interface ToolbarProps {
  onSearchOpen: () => void;
  onExportOpen: () => void;
}

export default function Toolbar({ onSearchOpen, onExportOpen }: ToolbarProps) {
  const addTable = useSchemaStore((s) => s.addTable);
  const loadSchema = useSchemaStore((s) => s.loadSchema);
  const schemaName = useSchemaStore((s) => s.schemaName);
  const setSchemaName = useSchemaStore((s) => s.setSchemaName);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onNameSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === schemaName) return;
      const recentNames = getRecentList()
        .map((e) => e.name)
        .filter((n) => n !== schemaName);
      const safeName = dedupName(trimmed, recentNames);
      renameStoredSchema(schemaName, safeName);
      setSchemaName(safeName);
    },
    [schemaName, setSchemaName],
  );

  const { isEditing, handleSubmit, startEditing, cancelEditing } = useInlineEdit(onNameSubmit);

  const recentSchemas = getRecentList().filter((e) => e.name !== schemaName);

  const handleNewSchema = useCallback(() => {
    saveCurrentSchema();
    loadSchema([], [], 'Untitled');
  }, [loadSchema]);

  const handleLoadRecent = useCallback(
    (name: string) => {
      saveCurrentSchema();
      loadSchemaByName(name);
      fitView({ padding: 0.2, duration: 300 });
    },
    [fitView],
  );

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
          saveCurrentSchema();
          const { tables, relations, name } = importJSON(reader.result as string);
          const existingNames = getRecentList().map((entry) => entry.name);
          const safeName = dedupName(name, existingNames);
          loadSchema(tables, relations, safeName);
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
      {/* Schema name dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="schema-name-btn"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent focus:outline-none"
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startEditing();
          }}
          render={(props) => {
            if (isEditing) {
              return (
                <div
                  {...props}
                  className="flex items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    data-testid="schema-name-input"
                    className="max-w-[200px] rounded border border-input bg-background px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                    defaultValue={schemaName}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmit((e.target as HTMLInputElement).value);
                      } else if (e.key === 'Escape') {
                        cancelEditing();
                      }
                    }}
                    onBlur={(e) => handleSubmit(e.target.value)}
                  />
                </div>
              );
            }
            return (
              <button {...props}>
                <span
                  data-testid="schema-name-display"
                  className="max-w-[200px] truncate"
                >
                  {schemaName}
                </span>
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            );
          }}
        />
        <DropdownMenuContent data-testid="schema-dropdown">
          <DropdownMenuItem
            data-testid="new-schema-btn"
            onClick={handleNewSchema}
          >
            <FilePlus2 className="size-4" />
            New schema
          </DropdownMenuItem>
          {recentSchemas.length > 0 && <DropdownMenuSeparator />}
          {recentSchemas.map((entry) => (
            <DropdownMenuItem
              key={entry.name}
              data-testid={`recent-schema-${entry.name}`}
              onClick={() => handleLoadRecent(entry.name)}
            >
              <span className="flex-1 truncate">{entry.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {entry.tableCount} table{entry.tableCount !== 1 ? 's' : ''}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

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
