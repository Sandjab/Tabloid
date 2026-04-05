# Schema Name + Recent Schemas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add named schemas with per-schema localStorage persistence and a toolbar dropdown to switch between the 5 most recent schemas.

**Architecture:** Add `schemaName` to the Zustand store, refactor auto-save to use per-schema localStorage keys with a recent-schemas index, and add a toolbar dropdown for switching/creating schemas. Export uses the schema name for filenames.

**Tech Stack:** React, Zustand, shadcn DropdownMenu, localStorage

---

### Task 1: Add `schemaName` to the store

**Files:**
- Modify: `src/store/useSchemaStore.ts:25-67` (SchemaState interface)
- Modify: `src/store/useSchemaStore.ts:564-571` (loadSchema action)
- Test: `tests/store/useSchemaStore.test.ts` (if exists, else create)

- [ ] **Step 1: Add `schemaName` and `setSchemaName` to `SchemaState` interface**

In `src/store/useSchemaStore.ts`, add to the `SchemaState` interface (after line 29):

```typescript
  schemaName: string;
  setSchemaName: (name: string) => void;
```

Update the `loadSchema` signature (line 65):

```typescript
  loadSchema: (tables: Table[], relations: Relation[], name?: string) => void;
```

- [ ] **Step 2: Implement the state and actions**

In the store creation (around line 200, initial state), add:

```typescript
      schemaName: 'Untitled',
```

Add the `setSchemaName` action (after `rebuildNodesFromTables`):

```typescript
      setSchemaName: (name) => {
        set({ schemaName: name });
      },
```

Update `loadSchema` implementation (line 564):

```typescript
      loadSchema: (tables, relations, name) => {
        set({
          schemaName: name ?? 'Untitled',
          tables,
          relations,
          nodes: buildNodesFromTables(tables),
          edges: buildEdgesFromRelations(relations, tables),
        });
      },
```

- [ ] **Step 3: Exclude `schemaName` from undo/redo**

The `partialize` function (line 581) controls what's tracked by zundo. Keep it as-is — only `tables` and `relations`. The `schemaName` should NOT be part of undo/redo history.

- [ ] **Step 4: Run type check**

Run: `npm run type-check`
Expected: PASS (no errors)

- [ ] **Step 5: Commit**

```bash
git add src/store/useSchemaStore.ts
git commit -m "feat: add schemaName to store with setSchemaName and updated loadSchema"
```

---

### Task 2: Refactor auto-save for per-schema persistence

**Files:**
- Modify: `src/hooks/useAutoSave.ts`
- Modify: `src/App.tsx:16` (loadFromLocalStorage call)

- [ ] **Step 1: Define the recent-schemas index type and constants**

Replace the contents of `src/hooks/useAutoSave.ts`:

```typescript
import { useEffect, useRef } from 'react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { exportJSON } from '@/utils/export-json';
import { importJSON } from '@/utils/import-json';

const RECENT_KEY = 'tabloid-recent';
const SCHEMA_PREFIX = 'tabloid-schema-';
const OLD_KEY = 'tabloid-schema';
const MAX_RECENT = 5;
const DEBOUNCE_MS = 500;

interface RecentEntry {
  name: string;
  tableCount: number;
}

function getRecentList(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentList(list: RecentEntry[]): void {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

function updateRecentEntry(name: string, tableCount: number): void {
  const list = getRecentList().filter((e) => e.name !== name);
  list.unshift({ name, tableCount });
  saveRecentList(list);
}

function removeRecentEntry(name: string): void {
  const list = getRecentList().filter((e) => e.name !== name);
  saveRecentList(list);
}

function saveSchema(name: string, tables: unknown[], relations: unknown[]): void {
  const json = exportJSON(tables as import('@/types/schema').Table[], relations as import('@/types/schema').Relation[], name);
  localStorage.setItem(SCHEMA_PREFIX + name, json);
  updateRecentEntry(name, tables.length);
}

export function saveCurrentSchema(): void {
  const { schemaName, tables, relations } = useSchemaStore.getState();
  saveSchema(schemaName, tables, relations);
}

export function loadSchemaByName(name: string): boolean {
  const raw = localStorage.getItem(SCHEMA_PREFIX + name);
  if (!raw) return false;
  try {
    const { tables, relations, name: importedName } = importJSON(raw);
    useSchemaStore.getState().loadSchema(tables, relations, importedName || name);
    return true;
  } catch {
    return false;
  }
}

export function renameStoredSchema(oldName: string, newName: string): void {
  const raw = localStorage.getItem(SCHEMA_PREFIX + oldName);
  if (raw) {
    localStorage.removeItem(SCHEMA_PREFIX + oldName);
    localStorage.setItem(SCHEMA_PREFIX + newName, raw);
  }
  const list = getRecentList().map((e) =>
    e.name === oldName ? { ...e, name: newName } : e,
  );
  saveRecentList(list);
}

export function deleteStoredSchema(name: string): void {
  localStorage.removeItem(SCHEMA_PREFIX + name);
  removeRecentEntry(name);
}

export { getRecentList, type RecentEntry };

export function loadFromLocalStorage(): boolean {
  // Migration: old single-key format
  const oldRaw = localStorage.getItem(OLD_KEY);
  if (oldRaw) {
    try {
      const { tables, relations } = importJSON(oldRaw);
      useSchemaStore.getState().loadSchema(tables, relations, 'Untitled');
      saveSchema('Untitled', tables, relations);
      localStorage.removeItem(OLD_KEY);
      return true;
    } catch {
      localStorage.removeItem(OLD_KEY);
    }
  }

  // Load most recent schema
  const recent = getRecentList();
  if (recent.length > 0) {
    return loadSchemaByName(recent[0].name);
  }
  return false;
}

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevRef = useRef<{ tables: unknown; relations: unknown; schemaName: unknown }>({
    tables: null,
    relations: null,
    schemaName: null,
  });

  useEffect(() => {
    const unsubscribe = useSchemaStore.subscribe((state) => {
      if (
        state.tables === prevRef.current.tables &&
        state.relations === prevRef.current.relations &&
        state.schemaName === prevRef.current.schemaName
      ) {
        return;
      }
      prevRef.current = { tables: state.tables, relations: state.relations, schemaName: state.schemaName };

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveSchema(state.schemaName, state.tables, state.relations);
      }, DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timerRef.current);
      unsubscribe();
    };
  }, []);
}
```

- [ ] **Step 2: Run type check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `npm run test`
Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAutoSave.ts
git commit -m "feat: per-schema localStorage persistence with recent-schemas index"
```

---

### Task 3: Add dedup helper for schema name collisions

**Files:**
- Modify: `src/utils/naming.ts`
- Test: `tests/utils/naming.test.ts` (if exists, else create)

- [ ] **Step 1: Add `dedupName` function to `src/utils/naming.ts`**

Append to the file:

```typescript
export function dedupName(name: string, existingNames: string[]): string {
  if (!existingNames.includes(name)) return name;
  let i = 2;
  while (existingNames.includes(`${name} (${i})`)) i++;
  return `${name} (${i})`;
}
```

- [ ] **Step 2: Run type check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/utils/naming.ts
git commit -m "feat: add dedupName helper for schema name collisions"
```

---

### Task 4: Install shadcn DropdownMenu and build toolbar schema selector

**Files:**
- Create: `src/components/ui/dropdown-menu.tsx` (via shadcn CLI)
- Modify: `src/components/Toolbar/Toolbar.tsx`

- [ ] **Step 1: Install shadcn dropdown-menu**

Run: `npx shadcn@latest add dropdown-menu`
Expected: creates `src/components/ui/dropdown-menu.tsx`

- [ ] **Step 2: Update Toolbar with schema name dropdown**

Replace `src/components/Toolbar/Toolbar.tsx`:

```typescript
import { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useTheme } from '@/hooks/useTheme';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { computeAutoLayout } from '@/utils/auto-layout';
import { importJSON } from '@/utils/import-json';
import { dedupName } from '@/utils/naming';
import {
  saveCurrentSchema,
  loadSchemaByName,
  renameStoredSchema,
  getRecentList,
} from '@/hooks/useAutoSave';
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
      const recent = getRecentList();
      const existingNames = recent.map((e) => e.name).filter((n) => n !== schemaName);
      const safeName = dedupName(trimmed, existingNames);
      renameStoredSchema(schemaName, safeName);
      setSchemaName(safeName);
    },
    [schemaName, setSchemaName],
  );
  const { isEditing, handleSubmit, startEditing, cancelEditing } =
    useInlineEdit(onNameSubmit);

  const handleNewSchema = useCallback(() => {
    saveCurrentSchema();
    loadSchema([], [], 'Untitled');
  }, [loadSchema]);

  const handleSwitchSchema = useCallback(
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
          const recent = getRecentList();
          const existingNames = recent.map((r) => r.name);
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

  const recentSchemas = getRecentList().filter((e) => e.name !== schemaName);

  return (
    <div
      className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-lg bg-popover p-1 shadow-sm ring-1 ring-border"
      data-testid="toolbar"
    >
      {/* Schema name dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-foreground hover:bg-accent"
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startEditing();
            }}
            data-testid="schema-name-btn"
          >
            {isEditing ? (
              <input
                className="w-[160px] rounded border border-input bg-transparent px-1 text-sm outline-none"
                defaultValue={schemaName}
                autoFocus
                onBlur={(e) => handleSubmit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit(e.currentTarget.value);
                  if (e.key === 'Escape') cancelEditing();
                }}
                onClick={(e) => e.stopPropagation()}
                data-testid="schema-name-input"
              />
            ) : (
              <span className="max-w-[200px] truncate" data-testid="schema-name-display">
                {schemaName}
              </span>
            )}
            {!isEditing && <ChevronDown className="size-3 text-muted-foreground" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56" data-testid="schema-dropdown">
          <DropdownMenuItem onClick={handleNewSchema} data-testid="new-schema-btn">
            <FilePlus2 className="mr-2 size-3.5" />
            New schema
          </DropdownMenuItem>
          {recentSchemas.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {recentSchemas.map((entry) => (
                <DropdownMenuItem
                  key={entry.name}
                  onClick={() => handleSwitchSchema(entry.name)}
                  data-testid={`recent-schema-${entry.name}`}
                >
                  <span className="truncate">{entry.name}</span>
                  <span className="ml-auto pl-2 text-xs text-muted-foreground">
                    {entry.tableCount} table{entry.tableCount !== 1 ? 's' : ''}
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          )}
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
```

- [ ] **Step 3: Run type check**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx src/components/Toolbar/Toolbar.tsx
git commit -m "feat: add schema name dropdown with recent schemas to toolbar"
```

---

### Task 5: Update export to use schema name in filenames

**Files:**
- Modify: `src/components/ExportDialog/ExportDialog.tsx`

- [ ] **Step 1: Use `schemaName` from the store**

In `src/components/ExportDialog/ExportDialog.tsx`, add to the store selectors (after `relations`):

```typescript
  const schemaName = useSchemaStore((s) => s.schemaName);
```

- [ ] **Step 2: Update preview calls**

Replace the hardcoded `'schema'` in the preview `useMemo`:

```typescript
      case 'json':
        return exportJSON(tables, relations, schemaName);
      case 'yaml':
        return exportYAML(tables, relations, schemaName);
```

- [ ] **Step 3: Update download filenames**

Replace all hardcoded `'schema.'` filenames in `handleDownload`:

```typescript
      case 'sql':
        downloadText(preview, `${schemaName}.sql`);
        break;
      case 'json':
        downloadText(preview, `${schemaName}.tabloid.json`, 'application/json');
        break;
      case 'yaml':
        downloadText(preview, `${schemaName}.yaml`, 'text/yaml');
        break;
      case 'mermaid':
        downloadText(preview, `${schemaName}.mmd`);
        break;
      case 'dbml':
        downloadText(preview, `${schemaName}.dbml`);
        break;
      case 'excalidraw':
        downloadText(preview, `${schemaName}.excalidraw`, 'application/json');
        break;
      case 'png':
        await exportPNG(`${schemaName}.png`);
        break;
      case 'svg':
        await exportSVG(`${schemaName}.svg`);
        break;
```

- [ ] **Step 4: Run type check and tests**

Run: `npm run type-check && npm run test`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ExportDialog/ExportDialog.tsx
git commit -m "feat: use schema name in export preview and download filenames"
```

---

### Task 6: Verification and cleanup

- [ ] **Step 1: Manual verification**

Start dev server (`npm run dev`) and verify:
1. Schema name "Untitled" appears in toolbar on first load
2. Double-click the name → inline edit works
3. Click the name → dropdown opens with "New schema"
4. Create tables, rename schema to "orders"
5. Click "New schema" → canvas clears, name becomes "Untitled"
6. Dropdown now shows "orders — N tables" in recent list
7. Click "orders" → previous schema is restored
8. Import a `.tabloid.json` file → name from file is used
9. Export → filename uses schema name
10. Close and reopen browser → most recent schema loads
11. Rename to an existing name → suffix "(2)" is appended

- [ ] **Step 2: Run full test suite**

Run: `npm run type-check && npm run test && npm run lint`
Expected: All pass

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: schema name + recent schemas — complete feature"
git push
```
