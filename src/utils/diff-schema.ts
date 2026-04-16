import type { Column, Index, Relation, Table } from '@/types/schema';
import type {
  BaselineSource,
  ColumnDiff,
  ColumnField,
  IndexDiff,
  IndexField,
  RelationDiff,
  RelationField,
  SchemaDiff,
  TableDiff,
} from '@/types/diff';

// --- Entity matching (id first, fallback to name) ---

interface MatchResult<T> {
  matched: Array<[T, T]>;
  added: T[];
  removed: T[];
}

function matchByIdOrName<T extends { id: string; name: string }>(
  baseline: T[],
  current: T[],
): MatchResult<T> {
  const currentById = new Map<string, T>();
  const currentByName = new Map<string, T>();
  for (const c of current) {
    currentById.set(c.id, c);
    currentByName.set(c.name, c);
  }

  const matched: Array<[T, T]> = [];
  const usedCurrentIds = new Set<string>();

  for (const b of baseline) {
    const hit = currentById.get(b.id);
    if (hit) {
      matched.push([b, hit]);
      usedCurrentIds.add(hit.id);
    }
  }

  const matchedBaselineIds = new Set(matched.map(([b]) => b.id));
  for (const b of baseline) {
    if (matchedBaselineIds.has(b.id)) continue;
    const hit = currentByName.get(b.name);
    if (hit && !usedCurrentIds.has(hit.id)) {
      matched.push([b, hit]);
      matchedBaselineIds.add(b.id);
      usedCurrentIds.add(hit.id);
    }
  }

  const removed = baseline.filter((b) => !matchedBaselineIds.has(b.id));
  const added = current.filter((c) => !usedCurrentIds.has(c.id));

  return { matched, added, removed };
}

// --- Column-level diff ---

function columnChanges(b: Column, c: Column): ColumnField[] {
  const fields: ColumnField[] = [];
  if (b.name !== c.name) fields.push('name');
  if (b.type !== c.type) fields.push('type');
  if (b.isNullable !== c.isNullable) fields.push('nullable');
  if (b.isPrimaryKey !== c.isPrimaryKey) fields.push('primaryKey');
  if (b.isUnique !== c.isUnique) fields.push('unique');
  if ((b.defaultValue ?? null) !== (c.defaultValue ?? null)) fields.push('default');
  if ((b.description ?? '') !== (c.description ?? '')) fields.push('description');
  if ((b.precision ?? null) !== (c.precision ?? null)) fields.push('precision');
  if ((b.scale ?? null) !== (c.scale ?? null)) fields.push('scale');
  return fields;
}

// --- Index-level diff (resolves columnIds to names for cross-schema comparison) ---

function resolveIndexColumnNames(idx: Index, columns: Column[]): string[] {
  return idx.columnIds.map((id) => columns.find((c) => c.id === id)?.name ?? id);
}

function indexChanges(
  b: Index,
  c: Index,
  baselineCols: Column[],
  currentCols: Column[],
): IndexField[] {
  const fields: IndexField[] = [];
  if (b.name !== c.name) fields.push('name');
  if (b.isUnique !== c.isUnique) fields.push('isUnique');
  const bNames = resolveIndexColumnNames(b, baselineCols);
  const cNames = resolveIndexColumnNames(c, currentCols);
  if (bNames.length !== cNames.length || bNames.some((n, i) => n !== cNames[i])) {
    fields.push('columnIds');
  }
  return fields;
}

// --- Table-level diff ---

function diffTable(baseline: Table, current: Table): TableDiff {
  const columnMatch = matchByIdOrName(baseline.columns, current.columns);
  const columnDiffs: ColumnDiff[] = [];
  for (const [b, c] of columnMatch.matched) {
    const changes = columnChanges(b, c);
    if (changes.length > 0) {
      columnDiffs.push({ baseline: b, current: c, changes });
    }
  }

  const indexMatch = matchByIdOrName(baseline.indexes ?? [], current.indexes ?? []);
  const indexDiffs: IndexDiff[] = [];
  for (const [b, c] of indexMatch.matched) {
    const changes = indexChanges(b, c, baseline.columns, current.columns);
    if (changes.length > 0) {
      indexDiffs.push({ baseline: b, current: c, changes });
    }
  }

  return {
    baseline,
    current,
    renamed: baseline.name !== current.name,
    columns: {
      added: columnMatch.added,
      removed: columnMatch.removed,
      modified: columnDiffs,
    },
    indexes: {
      added: indexMatch.added,
      removed: indexMatch.removed,
      modified: indexDiffs,
    },
    notesChanged: (baseline.notes ?? '') !== (current.notes ?? ''),
  };
}

function isTableDiffMeaningful(diff: TableDiff): boolean {
  return (
    diff.renamed ||
    diff.notesChanged ||
    diff.columns.added.length > 0 ||
    diff.columns.removed.length > 0 ||
    diff.columns.modified.length > 0 ||
    diff.indexes.added.length > 0 ||
    diff.indexes.removed.length > 0 ||
    diff.indexes.modified.length > 0
  );
}

// --- Relation matching by semantic (name-based) key ---

function relationKey(rel: Relation, tables: Table[]): string | null {
  const srcT = tables.find((t) => t.id === rel.sourceTableId);
  const tgtT = tables.find((t) => t.id === rel.targetTableId);
  if (!srcT || !tgtT) return null;
  const srcC = srcT.columns.find((c) => c.id === rel.sourceColumnId);
  const tgtC = tgtT.columns.find((c) => c.id === rel.targetColumnId);
  if (!srcC || !tgtC) return null;
  return `${srcT.name}.${srcC.name}->${tgtT.name}.${tgtC.name}`;
}

function relationChanges(b: Relation, c: Relation): RelationField[] {
  const fields: RelationField[] = [];
  if (b.type !== c.type) fields.push('type');
  if ((b.sourceSide ?? 'right') !== (c.sourceSide ?? 'right')) fields.push('endpoints');
  else if ((b.targetSide ?? 'left') !== (c.targetSide ?? 'left')) fields.push('endpoints');
  return fields;
}

// --- Main entry ---

export interface SchemaSnapshot {
  tables: Table[];
  relations: Relation[];
}

export function diffSchema(
  baseline: SchemaSnapshot,
  current: SchemaSnapshot,
  source: BaselineSource,
): SchemaDiff {
  const tableMatch = matchByIdOrName(baseline.tables, current.tables);

  const tableDiffs: TableDiff[] = [];
  for (const [b, c] of tableMatch.matched) {
    const td = diffTable(b, c);
    if (isTableDiffMeaningful(td)) {
      tableDiffs.push(td);
    }
  }

  // Relations: match by semantic key (names) to survive id regeneration
  const currentRelByKey = new Map<string, Relation>();
  for (const r of current.relations) {
    const k = relationKey(r, current.tables);
    if (k) currentRelByKey.set(k, r);
  }

  const matchedRelationDiffs: RelationDiff[] = [];
  const matchedCurrentRelationIds = new Set<string>();
  const removedRelations: Relation[] = [];

  for (const b of baseline.relations) {
    const k = relationKey(b, baseline.tables);
    if (!k) {
      removedRelations.push(b);
      continue;
    }
    const hit = currentRelByKey.get(k);
    if (hit) {
      matchedCurrentRelationIds.add(hit.id);
      const changes = relationChanges(b, hit);
      if (changes.length > 0) {
        matchedRelationDiffs.push({ baseline: b, current: hit, changes });
      }
    } else {
      removedRelations.push(b);
    }
  }

  const addedRelations = current.relations.filter(
    (r) => !matchedCurrentRelationIds.has(r.id),
  );

  return {
    tables: {
      added: tableMatch.added,
      removed: tableMatch.removed,
      modified: tableDiffs,
    },
    relations: {
      added: addedRelations,
      removed: removedRelations,
      modified: matchedRelationDiffs,
    },
    baselineSource: source,
  };
}
