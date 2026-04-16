import type { Column, Index, Relation, Table } from '@/types/schema';

// --- Field-level change lists ---

export type ColumnField =
  | 'name'
  | 'type'
  | 'nullable'
  | 'primaryKey'
  | 'unique'
  | 'default'
  | 'description'
  | 'precision'
  | 'scale';

export type IndexField = 'name' | 'columnIds' | 'isUnique';

export type RelationField = 'type' | 'endpoints';

// --- Per-entity diffs ---

export interface ColumnDiff {
  baseline: Column;
  current: Column;
  changes: ColumnField[];
}

export interface IndexDiff {
  baseline: Index;
  current: Index;
  changes: IndexField[];
}

export interface TableDiff {
  baseline: Table;
  current: Table;
  renamed: boolean;
  columns: {
    added: Column[];
    removed: Column[];
    modified: ColumnDiff[];
  };
  indexes: {
    added: Index[];
    removed: Index[];
    modified: IndexDiff[];
  };
  notesChanged: boolean;
}

export interface RelationDiff {
  baseline: Relation;
  current: Relation;
  changes: RelationField[];
}

// --- Full schema diff ---

export type BaselineSourceKind = 'tag' | 'sql' | 'json';

export interface BaselineSource {
  kind: BaselineSourceKind;
  name: string;
  importedAt: string;
}

export interface SchemaDiff {
  tables: {
    added: Table[];
    removed: Table[];
    modified: TableDiff[];
  };
  relations: {
    added: Relation[];
    removed: Relation[];
    modified: RelationDiff[];
  };
  baselineSource: BaselineSource;
}

export function isDiffEmpty(diff: SchemaDiff): boolean {
  return (
    diff.tables.added.length === 0 &&
    diff.tables.removed.length === 0 &&
    diff.tables.modified.length === 0 &&
    diff.relations.added.length === 0 &&
    diff.relations.removed.length === 0 &&
    diff.relations.modified.length === 0
  );
}
