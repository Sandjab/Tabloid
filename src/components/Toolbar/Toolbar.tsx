import { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useTheme } from '@/hooks/useTheme';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { computeAutoLayout } from '@/utils/auto-layout';
import { exportJSON } from '@/utils/export-json';
import { importJSON } from '@/utils/import-json';
import { parseSQL } from '@/utils/import-sql';
import { parseDBML } from '@/utils/import-dbml';
import { parsePrisma } from '@/utils/import-prisma';
import { downloadText } from '@/utils/download';
import { dedupName } from '@/utils/naming';
import { saveCurrentSchema, loadSchemaByName, renameStoredSchema, getRecentList } from '@/hooks/useAutoSave';
import { ALL_DIALECT_IDS, DIALECT_DISPLAY_NAMES } from '@/dialects';
import { buildShareUrl } from '@/utils/url-share';
import type { DialectId } from '@/types/schema';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Save,
  FolderOpen,
  Download,
  Upload,
  Search,
  Moon,
  Sun,
  ChevronDown,
  FilePlus2,
  Clipboard,
  ClipboardPaste,
  Database,
  GitCompare,
  Link2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useDiffStore } from '@/store/useDiffStore';
import { validateSchema } from '@/utils/validate-schema';
import { useMemo } from 'react';

interface ToolbarProps {
  onSearchOpen: () => void;
  onExportOpen: () => void;
  onDiffOpen: () => void;
  onLintOpen: () => void;
  onAiOpen: () => void;
}

export default function Toolbar({ onSearchOpen, onExportOpen, onDiffOpen, onLintOpen, onAiOpen }: ToolbarProps) {
  const diffBaseline = useDiffStore((s) => s.baseline);
  const addTable = useSchemaStore((s) => s.addTable);
  const loadSchema = useSchemaStore((s) => s.loadSchema);
  const schemaName = useSchemaStore((s) => s.schemaName);
  const setSchemaName = useSchemaStore((s) => s.setSchemaName);
  const dialect = useSchemaStore((s) => s.dialect);
  const setDialect = useSchemaStore((s) => s.setDialect);
  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);

  const issueCount = useMemo(() => {
    const ws = validateSchema(tables, relations, dialect);
    return {
      total: ws.length,
      errors: ws.filter((w) => w.severity === 'error').length,
      warnings: ws.filter((w) => w.severity === 'warning').length,
    };
  }, [tables, relations, dialect]);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadInputRef = useRef<HTMLInputElement>(null);

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

  const handleCopyToClipboard = useCallback(() => {
    const { tables, relations, schemaName: name, dialect: d } = useSchemaStore.getState();
    const json = exportJSON(tables, relations, name, d);
    navigator.clipboard.writeText(json);
  }, []);

  const handleCopyShareLink = useCallback(async () => {
    const { tables, relations, schemaName: name, dialect: d } = useSchemaStore.getState();
    if (tables.length === 0) {
      toast('Nothing to share — add a table first');
      return;
    }
    const url = buildShareUrl({ tables, relations, name, dialect: d });
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied', {
        description: `${url.length} chars · recipients open Tabloid at this link to load the schema`,
      });
    } catch {
      toast.error('Failed to copy link to clipboard');
    }
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      saveCurrentSchema();
      const { tables, relations, name, dialect: d } = importJSON(text);
      const existingNames = getRecentList().map((e) => e.name);
      const safeName = dedupName(name, existingNames);
      loadSchema(tables, relations, safeName, d);
      fitView({ padding: 0.2, duration: 300 });
    } catch (err) {
      alert(`Paste failed: ${err instanceof Error ? err.message : 'Invalid clipboard content'}`);
    }
  }, [loadSchema, fitView]);

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

  const handleSave = useCallback(() => {
    const { tables, relations, schemaName: name, dialect: d } = useSchemaStore.getState();
    const json = exportJSON(tables, relations, name, d);
    downloadText(json, `${name}.tabloid.json`, 'application/json');
    toast(`Saved ${name}.tabloid.json`);
  }, []);

  const handleLoad = useCallback(() => {
    loadInputRef.current?.click();
  }, []);

  const handleLoadFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          saveCurrentSchema();
          const { tables, relations, name, dialect: d } = importJSON(reader.result as string);
          const existingNames = getRecentList().map((entry) => entry.name);
          const safeName = dedupName(name, existingNames);
          loadSchema(tables, relations, safeName, d);
          fitView({ padding: 0.2, duration: 300 });
          toast('Previous schema available in recents');
        } catch (err) {
          alert(`Load failed: ${err instanceof Error ? err.message : 'Invalid file'}`);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [loadSchema, fitView],
  );

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
          const content = reader.result as string;
          const lower = file.name.toLowerCase();
          const looksLikeSql = /^\s*(--|\/\*|CREATE\s|ALTER\s)/i.test(content);
          const looksLikeDBML = /^\s*(?:\/\/|\/\*|Table\s+[A-Za-z_"]|Ref[\s:])/m.test(content);
          const looksLikePrisma = /^\s*model\s+[A-Za-z_]/m.test(content);

          let result;
          if (lower.endsWith('.dbml') || (looksLikeDBML && !looksLikeSql && !looksLikePrisma)) {
            result = parseDBML(content);
          } else if (lower.endsWith('.prisma') || looksLikePrisma) {
            result = parsePrisma(content);
          } else if (lower.endsWith('.sql') || looksLikeSql) {
            result = parseSQL(content);
          } else {
            result = importJSON(content);
          }

          const existingNames = getRecentList().map((entry) => entry.name);
          const safeName = dedupName(result.name, existingNames);
          const importedDialect = 'dialect' in result ? (result as { dialect: DialectId }).dialect : undefined;
          loadSchema(result.tables, result.relations, safeName, importedDialect);
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
      className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-popover p-1 shadow-sm ring-1 ring-border"
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
        <DropdownMenuContent className="min-w-[220px]" data-testid="schema-dropdown">
          <DropdownMenuItem
            data-testid="new-schema-btn"
            onClick={handleNewSchema}
          >
            <FilePlus2 className="size-4" />
            New schema
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-testid="copy-clipboard-btn"
            onClick={handleCopyToClipboard}
          >
            <Clipboard className="size-4" />
            Copy to clipboard
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="copy-share-link-btn"
            onClick={handleCopyShareLink}
          >
            <Link2 className="size-4" />
            Copy share link
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="paste-clipboard-btn"
            onClick={handlePasteFromClipboard}
          >
            <ClipboardPaste className="size-4" />
            Paste from clipboard
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

      {/* Dialect selector */}
      <Select
        value={dialect}
        onValueChange={(val) => { if (val) setDialect(val as DialectId); }}
      >
        <SelectTrigger
          size="sm"
          className="h-7 gap-1 border-none bg-transparent px-2 text-xs shadow-none hover:bg-accent"
          data-testid="dialect-select"
        >
          <Database className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALL_DIALECT_IDS.map((d) => (
            <SelectItem key={d} value={d}>
              {DIALECT_DISPLAY_NAMES[d]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
        onClick={handleSave}
        title="Save (Ctrl+S)"
        data-testid="save-btn"
      >
        <Save className="size-3.5" />
        Save
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLoad}
        title="Load (Ctrl+O)"
        data-testid="load-btn"
      >
        <FolderOpen className="size-3.5" />
        Load
      </Button>
      <input
        ref={loadInputRef}
        type="file"
        accept=".tabloid.json"
        className="hidden"
        onChange={handleLoadFileChange}
        data-testid="load-file-input"
      />

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
        variant={diffBaseline ? 'default' : 'ghost'}
        size="sm"
        onClick={onDiffOpen}
        title="Diff schema & generate migration"
        data-testid="diff-btn"
      >
        <GitCompare className="size-3.5" />
        Diff
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onLintOpen}
        title={`Validation (${issueCount.total} issue${issueCount.total === 1 ? '' : 's'})`}
        data-testid="lint-btn"
      >
        <ShieldCheck
          className={`size-3.5 ${
            issueCount.errors > 0
              ? 'text-red-500'
              : issueCount.warnings > 0
                ? 'text-amber-500'
                : issueCount.total > 0
                  ? 'text-sky-500'
                  : 'text-emerald-500'
          }`}
        />
        Lint
        {issueCount.total > 0 && (
          <span
            className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-medium"
            data-testid="lint-badge"
          >
            {issueCount.total}
          </span>
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onAiOpen}
        title="AI assistant"
        data-testid="ai-btn"
      >
        <Sparkles className="size-3.5 text-violet-500" />
        AI
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
        accept=".json,.sql,.dbml,.prisma"
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
