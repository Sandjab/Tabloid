import type { Relation, Table } from '@/types/schema';
import type { AlterableColumnField, Dialect } from '@/dialects/types';
import type { SchemaDiff } from '@/types/diff';
import type { SchemaSnapshot } from '@/utils/diff-schema';
import { exportSQL } from '@/utils/export-sql';
import { defaultForeignKeyName } from '@/dialects/base';

interface ResolvedRelation {
  srcTable: string;
  srcCol: string;
  tgtTable: string;
  tgtCol: string;
}

function resolveRelation(rel: Relation, tables: Table[]): ResolvedRelation | null {
  const srcT = tables.find((t) => t.id === rel.sourceTableId);
  const tgtT = tables.find((t) => t.id === rel.targetTableId);
  if (!srcT || !tgtT) return null;
  const srcC = srcT.columns.find((c) => c.id === rel.sourceColumnId);
  const tgtC = tgtT.columns.find((c) => c.id === rel.targetColumnId);
  if (!srcC || !tgtC) return null;
  return { srcTable: srcT.name, srcCol: srcC.name, tgtTable: tgtT.name, tgtCol: tgtC.name };
}

function columnNamesOf(table: Table, columnIds: string[]): string[] {
  return columnIds.map((id) => table.columns.find((c) => c.id === id)?.name ?? id);
}

export function exportMigration(
  diff: SchemaDiff,
  baseline: SchemaSnapshot,
  current: SchemaSnapshot,
  dialect: Dialect,
): string {
  const stmts: string[] = [];
  const header = [
    `-- Migration — ${dialect.name}`,
    `-- Baseline: ${diff.baselineSource.kind}:${diff.baselineSource.name} (${diff.baselineSource.importedAt})`,
  ].join('\n');
  stmts.push(header);

  // Phase 1: DROP foreign keys (relations removed) — must happen before column/table drops
  for (const rel of diff.relations.removed) {
    const r = resolveRelation(rel, baseline.tables);
    if (!r) continue;
    stmts.push(dialect.formatDropForeignKey(r.srcTable, defaultForeignKeyName(r.srcTable, r.srcCol)));
  }

  // Phase 2: DROP indexes on modified tables
  for (const td of diff.tables.modified) {
    for (const idx of td.indexes.removed) {
      stmts.push(dialect.formatDropIndex(td.baseline.name, idx.name));
    }
  }

  // Phase 3: DROP columns from modified tables
  for (const td of diff.tables.modified) {
    for (const col of td.columns.removed) {
      stmts.push(dialect.formatDropColumn(td.baseline.name, col.name));
    }
  }

  // Phase 4: DROP tables
  for (const t of diff.tables.removed) {
    stmts.push(dialect.formatDropTable(t.name));
  }

  // Phase 5: RENAME tables (before any subsequent reference uses current name)
  for (const td of diff.tables.modified) {
    if (td.renamed) {
      stmts.push(dialect.formatRenameTable(td.baseline.name, td.current.name));
    }
  }

  // Phase 6: CREATE TABLES (added) — includes comments and indexes, no FKs
  if (diff.tables.added.length > 0) {
    const createSql = exportSQL(diff.tables.added, [], dialect);
    if (createSql.trim().length > 0) stmts.push(createSql);
  }

  // Phase 7: Column modifications on existing (modified) tables
  for (const td of diff.tables.modified) {
    const tableName = td.current.name;

    // 7a. Column renames first so subsequent ADD/MODIFY use current names
    for (const cd of td.columns.modified) {
      if (cd.changes.includes('name')) {
        stmts.push(dialect.formatRenameColumn(tableName, cd.baseline.name, cd.current.name));
      }
    }

    // 7b. ADD new columns
    for (const col of td.columns.added) {
      stmts.push(dialect.formatAddColumn(tableName, col));
    }

    // 7c. ALTER existing columns (non-name changes)
    for (const cd of td.columns.modified) {
      const nonNameChanges = cd.changes.filter(
        (ch): ch is AlterableColumnField => ch !== 'name',
      );
      if (nonNameChanges.length > 0) {
        const alterStmts = dialect.formatAlterColumn(
          tableName,
          cd.baseline,
          cd.current,
          nonNameChanges,
        );
        stmts.push(...alterStmts);
      }
    }

    // 7d. Index additions
    for (const idx of td.indexes.added) {
      const names = columnNamesOf(td.current, idx.columnIds);
      if (names.length > 0) {
        stmts.push(dialect.formatCreateIndex(tableName, idx.name, names, idx.isUnique));
      }
    }

    // 7e. Index modifications → drop + recreate
    for (const idxDiff of td.indexes.modified) {
      stmts.push(dialect.formatDropIndex(tableName, idxDiff.baseline.name));
      const names = columnNamesOf(td.current, idxDiff.current.columnIds);
      if (names.length > 0) {
        stmts.push(
          dialect.formatCreateIndex(tableName, idxDiff.current.name, names, idxDiff.current.isUnique),
        );
      }
    }
  }

  // Phase 8: ADD foreign keys (new relations + modified relations)
  for (const rel of diff.relations.added) {
    const r = resolveRelation(rel, current.tables);
    if (!r) continue;
    stmts.push(
      dialect.formatAddForeignKey(
        r.srcTable,
        r.srcCol,
        r.tgtTable,
        r.tgtCol,
        defaultForeignKeyName(r.srcTable, r.srcCol),
      ),
    );
  }

  for (const rd of diff.relations.modified) {
    const rBase = resolveRelation(rd.baseline, baseline.tables);
    const rCur = resolveRelation(rd.current, current.tables);
    if (!rBase || !rCur) continue;
    // Drop old FK then re-add with (potentially) new type. Constraint name stays.
    stmts.push(dialect.formatDropForeignKey(rBase.srcTable, defaultForeignKeyName(rBase.srcTable, rBase.srcCol)));
    stmts.push(
      dialect.formatAddForeignKey(
        rCur.srcTable,
        rCur.srcCol,
        rCur.tgtTable,
        rCur.tgtCol,
        defaultForeignKeyName(rCur.srcTable, rCur.srcCol),
      ),
    );
  }

  return stmts.join('\n\n');
}
