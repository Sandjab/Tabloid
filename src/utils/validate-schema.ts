import type { Table, Relation } from '@/types/schema';

export interface ValidationWarning {
  type:
    | 'duplicate-table-name'
    | 'fk-missing-column'
    | 'fk-incompatible-types'
    | 'duplicate-column-name'
    | 'missing-primary-key'
    | 'empty-table'
    | 'index-missing-column'
    | 'nn-direct-relation';
  severity: 'error' | 'warning';
  tableId: string;
  columnId?: string;
  message: string;
}

export function validateSchema(
  tables: Table[],
  relations: Relation[],
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const columnMap = new Map<string, { tableId: string; type: string }>();

  // Duplicate table names
  const tableNames = new Map<string, string>();
  for (const table of tables) {
    const lower = table.name.toLowerCase();
    if (tableNames.has(lower)) {
      warnings.push({
        type: 'duplicate-table-name',
        severity: 'error',
        tableId: table.id,
        message: `Duplicate table name "${table.name}"`,
      });
    }
    tableNames.set(lower, table.id);
  }

  for (const table of tables) {
    // Empty table
    if (table.columns.length === 0) {
      warnings.push({
        type: 'empty-table',
        severity: 'warning',
        tableId: table.id,
        message: `Table "${table.name}" has no columns`,
      });
    }

    // Missing primary key
    if (table.columns.length > 0 && !table.columns.some((c) => c.isPrimaryKey)) {
      warnings.push({
        type: 'missing-primary-key',
        severity: 'warning',
        tableId: table.id,
        message: `Table "${table.name}" has no primary key`,
      });
    }

    // Duplicate column names
    const colNames = new Set<string>();
    for (const col of table.columns) {
      if (colNames.has(col.name)) {
        warnings.push({
          type: 'duplicate-column-name',
          severity: 'error',
          tableId: table.id,
          columnId: col.id,
          message: `Table "${table.name}" has duplicate column name "${col.name}"`,
        });
      }
      colNames.add(col.name);
      columnMap.set(col.id, { tableId: table.id, type: col.type });
    }

    // Index references missing column
    for (const idx of table.indexes ?? []) {
      for (const colId of idx.columnIds) {
        if (!table.columns.some((c) => c.id === colId)) {
          warnings.push({
            type: 'index-missing-column',
            severity: 'error',
            tableId: table.id,
            columnId: colId,
            message: `Index "${idx.name}" on "${table.name}" references a missing column`,
          });
        }
      }
    }
  }

  // Relation checks
  for (const rel of relations) {
    const src = columnMap.get(rel.sourceColumnId);
    const tgt = columnMap.get(rel.targetColumnId);

    if (!src || !tgt) {
      warnings.push({
        type: 'fk-missing-column',
        severity: 'error',
        tableId: src?.tableId ?? tgt?.tableId ?? rel.sourceTableId,
        message: `Relation references a missing column`,
      });
      continue;
    }

    if (src.type !== tgt.type) {
      const srcTable = tables.find((t) => t.id === rel.sourceTableId);
      const tgtTable = tables.find((t) => t.id === rel.targetTableId);
      warnings.push({
        type: 'fk-incompatible-types',
        severity: 'warning',
        tableId: rel.sourceTableId,
        columnId: rel.sourceColumnId,
        message: `FK between "${srcTable?.name}" and "${tgtTable?.name}" has incompatible types (${src.type} vs ${tgt.type})`,
      });
    }

    if (rel.type === 'many-to-many') {
      const srcTable = tables.find((t) => t.id === rel.sourceTableId);
      const tgtTable = tables.find((t) => t.id === rel.targetTableId);
      warnings.push({
        type: 'nn-direct-relation',
        severity: 'warning',
        tableId: rel.sourceTableId,
        message: `Direct N:N relation between "${srcTable?.name}" and "${tgtTable?.name}" — use a junction table`,
      });
    }
  }

  return warnings;
}
