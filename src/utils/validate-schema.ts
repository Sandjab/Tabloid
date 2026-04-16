import type { Table, Relation, DialectId } from '@/types/schema';
import type { NativeTypeDefinition } from '@/dialects/types';
import { getCatalogForDialect } from '@/dialects';

function areTypesCompatible(
  a: string,
  b: string,
  catalog: NativeTypeDefinition[],
): boolean {
  if (a === b) return true;
  const familyA = catalog.find((t) => t.name === a)?.family;
  const familyB = catalog.find((t) => t.name === b)?.family;
  return familyA != null && familyA === familyB;
}

export type ValidationType =
  | 'duplicate-table-name'
  | 'fk-missing-column'
  | 'fk-incompatible-types'
  | 'duplicate-column-name'
  | 'missing-primary-key'
  | 'empty-table'
  | 'index-missing-column'
  | 'nn-direct-relation'
  | 'fk-cycle'
  | 'fk-missing-index'
  | 'naming-inconsistency'
  | 'reserved-word'
  | 'orphan-table';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationWarning {
  type: ValidationType;
  severity: ValidationSeverity;
  tableId: string;
  columnId?: string;
  message: string;
}

// SQL reserved words that surface as column/table names. Covers the top-of-mind
// collisions across PG/MySQL/SQL Server/Oracle/SQLite. Not exhaustive on purpose —
// we only warn about the ones that actually break CREATE TABLE without quoting.
const COMMON_RESERVED_WORDS = new Set([
  'user', 'users', 'order', 'orders', 'group', 'select', 'from', 'where',
  'table', 'column', 'index', 'view', 'grant', 'revoke', 'insert', 'update',
  'delete', 'create', 'drop', 'alter', 'primary', 'foreign', 'key', 'references',
  'constraint', 'default', 'check', 'unique', 'null', 'not', 'and', 'or', 'in',
  'exists', 'between', 'like', 'case', 'when', 'then', 'else', 'end', 'as',
  'on', 'join', 'inner', 'outer', 'left', 'right', 'union', 'having',
  'by', 'limit', 'offset', 'row', 'rows', 'value', 'values',
]);

function classifyNaming(name: string): 'snake' | 'camel' | 'pascal' | 'other' {
  if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')) return 'snake';
  if (/^[a-z][a-z0-9]*$/.test(name)) return 'snake'; // single lowercase word counts as snake-compatible
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camel';
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'pascal';
  return 'other';
}

// DFS back-edge detection over the FK graph. Returns the set of relation ids
// that participate in a cycle. Self-references are ignored. When a back-edge
// closes a cycle, only the relations between the cycle's entry-point and the
// back-edge (not the entire DFS path that led there) are flagged.
function detectCycleRelations(relations: Relation[]): Set<string> {
  const adj = new Map<string, Array<{ targetTableId: string; relId: string }>>();
  const relById = new Map<string, Relation>();
  for (const rel of relations) {
    relById.set(rel.id, rel);
    if (rel.sourceTableId === rel.targetTableId) continue;
    const list = adj.get(rel.sourceTableId) ?? [];
    list.push({ targetTableId: rel.targetTableId, relId: rel.id });
    adj.set(rel.sourceTableId, list);
  }

  const VISITING = 1;
  const VISITED = 2;
  const state = new Map<string, number>();
  const cycleRelIds = new Set<string>();

  function dfs(node: string, pathRels: string[]): void {
    state.set(node, VISITING);
    for (const edge of adj.get(node) ?? []) {
      const childState = state.get(edge.targetTableId);
      if (childState === VISITING) {
        // Back-edge closes a cycle. Flag only the path segment that starts at
        // the cycle's entry-point (the node the back-edge points to).
        cycleRelIds.add(edge.relId);
        const cycleStart = pathRels.findIndex(
          (rId) => relById.get(rId)?.sourceTableId === edge.targetTableId,
        );
        if (cycleStart !== -1) {
          for (let i = cycleStart; i < pathRels.length; i++) {
            cycleRelIds.add(pathRels[i]);
          }
        }
      } else if (childState !== VISITED) {
        pathRels.push(edge.relId);
        dfs(edge.targetTableId, pathRels);
        pathRels.pop();
      }
    }
    state.set(node, VISITED);
  }

  for (const node of adj.keys()) {
    if (!state.has(node)) dfs(node, []);
  }
  return cycleRelIds;
}

export function validateSchema(
  tables: Table[],
  relations: Relation[],
  dialectId: DialectId = 'generic',
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const catalog = getCatalogForDialect(dialectId);
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
    if (table.columns.length === 0) {
      warnings.push({
        type: 'empty-table',
        severity: 'warning',
        tableId: table.id,
        message: `Table "${table.name}" has no columns`,
      });
    }

    if (table.columns.length > 0 && !table.columns.some((c) => c.isPrimaryKey)) {
      warnings.push({
        type: 'missing-primary-key',
        severity: 'warning',
        tableId: table.id,
        message: `Table "${table.name}" has no primary key`,
      });
    }

    // Reserved word check — table name
    if (COMMON_RESERVED_WORDS.has(table.name.toLowerCase())) {
      warnings.push({
        type: 'reserved-word',
        severity: 'warning',
        tableId: table.id,
        message: `Table name "${table.name}" is a SQL reserved word — quote it or rename`,
      });
    }

    // Column name duplication is case-insensitive — matches the table-name
    // check above and how unquoted SQL identifiers collide in practice.
    const colNames = new Set<string>();
    for (const col of table.columns) {
      const lowerName = col.name.toLowerCase();
      if (colNames.has(lowerName)) {
        warnings.push({
          type: 'duplicate-column-name',
          severity: 'error',
          tableId: table.id,
          columnId: col.id,
          message: `Table "${table.name}" has duplicate column name "${col.name}"`,
        });
      }
      colNames.add(lowerName);
      columnMap.set(col.id, { tableId: table.id, type: col.type });

      if (COMMON_RESERVED_WORDS.has(col.name.toLowerCase())) {
        warnings.push({
          type: 'reserved-word',
          severity: 'warning',
          tableId: table.id,
          columnId: col.id,
          message: `Column "${table.name}.${col.name}" is a SQL reserved word — quote it or rename`,
        });
      }
    }

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

  // Relation checks (existing + new FK-missing-index)
  const cycleRelIds = detectCycleRelations(relations);

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

    if (!areTypesCompatible(src.type, tgt.type, catalog)) {
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

    if (cycleRelIds.has(rel.id)) {
      const srcTable = tables.find((t) => t.id === rel.sourceTableId);
      const tgtTable = tables.find((t) => t.id === rel.targetTableId);
      warnings.push({
        type: 'fk-cycle',
        severity: 'warning',
        tableId: rel.sourceTableId,
        columnId: rel.sourceColumnId,
        message: `FK cycle detected through "${srcTable?.name}" → "${tgtTable?.name}"`,
      });
    }

    // FK-missing-index: the FK source column is a lookup column that should be
    // indexed (unless it IS the PK or already UNIQUE, which implies an index).
    const srcTable = tables.find((t) => t.id === rel.sourceTableId);
    const srcCol = srcTable?.columns.find((c) => c.id === rel.sourceColumnId);
    if (srcTable && srcCol && !srcCol.isPrimaryKey && !srcCol.isUnique) {
      const hasIndex = (srcTable.indexes ?? []).some(
        (idx) => idx.columnIds[0] === rel.sourceColumnId,
      );
      if (!hasIndex) {
        warnings.push({
          type: 'fk-missing-index',
          severity: 'info',
          tableId: srcTable.id,
          columnId: srcCol.id,
          message: `FK column "${srcTable.name}.${srcCol.name}" has no index — consider adding one for join performance`,
        });
      }
    }
  }

  // Orphan tables (no FK in or out) — a hint, not a warning, since standalone
  // tables can be legit (audit logs, dicts…). Skip when there's only one table.
  if (tables.length > 1) {
    const connected = new Set<string>();
    for (const rel of relations) {
      connected.add(rel.sourceTableId);
      connected.add(rel.targetTableId);
    }
    for (const table of tables) {
      if (!connected.has(table.id) && table.columns.length > 0) {
        warnings.push({
          type: 'orphan-table',
          severity: 'info',
          tableId: table.id,
          message: `Table "${table.name}" has no relations — isolated island`,
        });
      }
    }
  }

  // Naming-inconsistency: hint once per schema if table names mix styles.
  if (tables.length >= 2) {
    const styles = new Set(tables.map((t) => classifyNaming(t.name)).filter((s) => s !== 'other'));
    if (styles.size > 1) {
      warnings.push({
        type: 'naming-inconsistency',
        severity: 'info',
        tableId: tables[0].id,
        message: `Mixed naming styles across tables (${[...styles].join(', ')}) — pick one convention`,
      });
    }
  }

  return warnings;
}
