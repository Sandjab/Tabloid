# Schema Name + Recent Schemas

## Problem

Tabloid has no concept of named schemas or switching between them. The store ignores the schema name, auto-save uses a single hardcoded localStorage key, and import drops the name from the file. Users can't work on multiple schemas or identify what they're editing.

## Solution

Add a schema name to the store, per-schema localStorage persistence, and a toolbar dropdown to switch between the 5 most recent schemas.

## Store Changes

**`src/store/useSchemaStore.ts`**

Add to `SchemaState`:
- `schemaName: string` — default `'Untitled'`
- `setSchemaName(name: string)` — renames the current schema

Update `loadSchema(tables, relations, name?)` to accept an optional name parameter (defaults to `'Untitled'`).

## localStorage Architecture

**Two key patterns:**

| Key | Content |
|-----|---------|
| `tabloid-schema-<name>` | Full JSON (tables, relations, name) — one key per saved schema |
| `tabloid-recent` | JSON array: `{ name: string, tableCount: number }[]` — max 5, most recent first |

**On auto-save:** write to `tabloid-schema-<currentName>`, update `tabloid-recent` (move current to top, trim to 5).

**On switch:** auto-save current schema first, then load selected schema from its key.

**On rename:** remove old key `tabloid-schema-<oldName>`, write to `tabloid-schema-<newName>`, update `tabloid-recent`. If `<newName>` already exists as a key, append suffix via `nextAvailableName` (e.g. "orders" → "orders (2)").

**On startup:** load `tabloid-recent`, load the first entry. If empty, start with a blank "Untitled" schema. Migration: if the old `tabloid-schema` key exists, import it as "Untitled" and delete the old key.

## UI: Toolbar (Left Side)

```
[Schema name ▾]  |  + Table  ...
```

**Interactions:**
- **Click** on the name area → opens dropdown
- **Double-click** → inline rename (reuses `useInlineEdit` pattern)
- **▾ chevron** is visual-only, not a separate click target

**Dropdown contents:**
```
+ New schema
─────────────
orders — 8 tables
users — 3 tables
analytics — 12 tables
─────────────────────
```

- `+ New schema` — auto-saves current, clears canvas, sets name to "Untitled"
- Recent items show `<name> — <N> tables` (no timestamps)
- Max 5 items. Old schemas fall off naturally. No "Clear history" action.

**Component:** shadcn `DropdownMenu` wrapping the name area.

**Name display:** truncated at ~200px with ellipsis. Font weight and size match existing toolbar buttons.

## Import Integration

**`src/components/Toolbar/Toolbar.tsx`**

When importing a `.tabloid.json` file:
1. Auto-save current schema
2. Extract name from the imported file (already returned by `importJSON`)
3. Call `loadSchema(tables, relations, name)`
4. Name collision guard: if name already in recent, append suffix

## Export Integration

**`src/components/ExportDialog/ExportDialog.tsx`**

- Use `schemaName` from store instead of hardcoded `'schema'`
- Download filenames use the schema name: `orders.tabloid.json`, `orders.sql`, `orders.dbml`, etc.

## Files Modified

| File | Change |
|------|--------|
| `src/store/useSchemaStore.ts` | Add `schemaName`, `setSchemaName`, update `loadSchema` signature |
| `src/hooks/useAutoSave.ts` | Per-schema keys, manage `tabloid-recent` index, migration from old key |
| `src/components/Toolbar/Toolbar.tsx` | Schema name display, dropdown, inline rename, "New schema" action |
| `src/components/ExportDialog/ExportDialog.tsx` | Use `schemaName` for preview/download filenames |

## Edge Cases

- **Name collision on rename:** append suffix via `nextAvailableName`
- **localStorage 5MB limit:** with 5 schemas of 100+ tables, could get tight. Known limitation, not solved in v1.
- **Empty recent list:** show only "+ New schema" in dropdown. On first startup, no recent schemas exist — the current blank schema is "Untitled".
- **Import overwrites current:** auto-save happens before import, so no work is lost.

## Verification

- Create a schema, name it, add tables. Switch to a new schema. Switch back — original is restored.
- Rename a schema to a name that already exists — suffix is appended.
- Import a `.tabloid.json` — name from file is used.
- Export — filename uses schema name.
- Close and reopen browser — most recent schema is loaded.
- Old `tabloid-schema` key is migrated on first load.
- Recent list caps at 5 entries.
